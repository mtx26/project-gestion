from decimal import Decimal

from django.db.models import Case, Count, DecimalField, ExpressionWrapper, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce, Round
from django.utils.dateparse import parse_date

from ..models import FinancialEntry


def annotate_financial_fields(queryset):
    """Annotates a TimeEntry queryset with `filter_cost_amount`/`filter_paid_amount`,
    used both for filtering (see `apply_time_entry_financial_filters`) and for the
    stats aggregate (see `compute_time_entry_stats`)."""
    cost_amount = Round(
        ExpressionWrapper(
            F("duration_minutes") * F("hourly_rate") / Value(60),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
        precision=2,
    )
    paid_amount = Coalesce(
        Sum(
            Case(
                When(
                    financial_entries__type=FinancialEntry.FinancialType.EXPENSE,
                    then=F("financial_entries__amount"),
                ),
                When(
                    financial_entries__type=FinancialEntry.FinancialType.REFUND,
                    then=-F("financial_entries__amount"),
                ),
                default=Value(0),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        ),
        Value(0),
        output_field=DecimalField(max_digits=12, decimal_places=2),
    )
    return queryset.annotate(filter_cost_amount=cost_amount, filter_paid_amount=paid_amount)


def apply_time_entry_financial_filters(queryset, request):
    """Applies date range and payment_status filters. Annotates when needed.

    Par defaut (payment_status="all"), les entrees deja entierement payees sont
    masquees ; `include_paid=true` les reintegre. Un `payment_status` explicite
    (paid/unpaid/partial/not_paid) prend le dessus sur ce masquage.
    """
    payment_status = request.query_params.get("payment_status", "all")
    include_paid = request.query_params.get("include_paid") == "true"
    start_date = parse_date(request.query_params.get("start_date", "") or "")
    end_date = parse_date(request.query_params.get("end_date", "") or "")

    has_status_filter = bool(payment_status) and payment_status not in ("all", "")
    needs_annotation = has_status_filter or not include_paid

    if needs_annotation:
        queryset = annotate_financial_fields(queryset)

    if start_date or end_date:
        date_filter = Q()
        if start_date:
            date_filter &= Q(start_date__date__gte=start_date)
        if end_date:
            date_filter &= Q(start_date__date__lte=end_date)
        queryset = queryset.filter(date_filter)

    if has_status_filter:
        if payment_status == "paid":
            return queryset.filter(filter_paid_amount__gte=F("filter_cost_amount"))
        if payment_status == "unpaid":
            return queryset.filter(
                filter_paid_amount__lte=Value(Decimal("0")),
                filter_cost_amount__gt=Value(Decimal("0")),
            )
        if payment_status == "partial":
            return queryset.filter(
                filter_paid_amount__gt=Value(Decimal("0")),
                filter_paid_amount__lt=F("filter_cost_amount"),
            )
        if payment_status == "not_paid":
            return queryset.filter(filter_cost_amount__gt=F("filter_paid_amount"))
        return queryset

    if not include_paid:
        # Masque les entrees deja entierement couvertes ; une entree a cout nul
        # (ex: taux horaire 0) est consideree couverte des sa creation.
        return queryset.filter(filter_paid_amount__lt=F("filter_cost_amount"))

    return queryset


def compute_time_entry_stats(queryset) -> dict:
    result = queryset.aggregate(
        total_duration=Coalesce(Sum("duration_minutes"), Value(0)),
        total_cost=Coalesce(
            Sum("filter_cost_amount"),
            Value(Decimal("0.00")),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
        total_paid=Coalesce(
            Sum("filter_paid_amount"),
            Value(Decimal("0.00")),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
        entry_count=Count("id"),
    )
    total_cost = result["total_cost"] or Decimal("0.00")
    total_paid = result["total_paid"] or Decimal("0.00")
    remaining = max(total_cost - total_paid, Decimal("0.00"))
    return {
        "duration_minutes": result["total_duration"] or 0,
        "cost_amount": str(total_cost.quantize(Decimal("0.01"))),
        "paid_amount": str(total_paid.quantize(Decimal("0.01"))),
        "remaining_amount": str(remaining.quantize(Decimal("0.01"))),
        "entry_count": result["entry_count"] or 0,
    }
