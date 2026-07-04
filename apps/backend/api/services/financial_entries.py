from collections import OrderedDict
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from ..models import FinancialEntry

ZERO_MONEY = Decimal("0.00")
MONEY_QUANTIZE = Decimal("0.01")


def get_project_financial_entries(user, project_id):
    return FinancialEntry.objects.for_project(project_id).accessible_to(user).with_relations()


def get_project_deleted_financial_entries(user, project_id):
    return FinancialEntry.deleted_objects.for_project(project_id).accessible_to(user).with_relations()


def build_financial_entry_chart(entries, *, group_by, start_date, end_date):
    """Build totals/series/categories buckets from a FinancialEntry `.values()` queryset."""
    totals = _empty_bucket()
    series = OrderedDict()
    categories = {}

    for entry in entries:
        amount = Decimal(entry["amount"])
        period = _format_period(entry["created_at"], group_by)
        category = entry["category"]

        _add_amount(totals, amount, entry["type"])
        _add_amount(series.setdefault(period, _empty_bucket()), amount, entry["type"])
        _add_amount(categories.setdefault(category, _empty_bucket()), amount, entry["type"])

    return {
        "group_by": group_by,
        "start_date": start_date,
        "end_date": end_date,
        "totals": _serialize_bucket(totals),
        "series": [
            {"period": period, **_serialize_bucket(bucket)}
            for period, bucket in series.items()
        ],
        "categories": [
            {"category": category, **_serialize_bucket(bucket)}
            for category, bucket in sorted(
                categories.items(),
                key=lambda item: item[0] or "",
            )
        ],
    }


def _format_period(created_at, group_by):
    local_date = timezone.localtime(created_at).date()

    if group_by == "day":
        return local_date.isoformat()

    return f"{local_date.year:04d}-{local_date.month:02d}"


def _empty_bucket():
    return {
        "count": 0,
        "expenses": ZERO_MONEY,
        "refunds": ZERO_MONEY,
        "balance": ZERO_MONEY,
    }


def _add_amount(bucket, amount, entry_type):
    bucket["count"] += 1

    if entry_type == FinancialEntry.FinancialType.EXPENSE:
        bucket["expenses"] += amount
        bucket["balance"] += amount
        return

    if entry_type == FinancialEntry.FinancialType.REFUND:
        bucket["refunds"] += amount
        bucket["balance"] -= amount
        return

    raise serializers.ValidationError({
        "type": "errors.financial_chart.unsupported_financial_type"
    })


def _serialize_bucket(bucket):
    return {
        "count": bucket["count"],
        "expenses": _money(bucket["expenses"]),
        "refunds": _money(bucket["refunds"]),
        "balance": _money(bucket["balance"]),
    }


def _money(value):
    return str(value.quantize(MONEY_QUANTIZE))
