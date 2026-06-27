from decimal import Decimal

from django.db.models import Count, DecimalField, Sum, Value
from django.db.models.functions import Coalesce


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
