from collections import OrderedDict
from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from ..models import FinancialEntry

ZERO_MONEY = Decimal("0.00")
MONEY_QUANTIZE = Decimal("0.01")

FINANCIAL_ENTRY_SOURCES = ("manual", "labor")


def financial_entry_source(has_time_entry):
    """The single rule behind a FinancialEntry's origin: linked to a TimeEntry
    means it came from paying/refunding someone's logged time ("labor"),
    otherwise it was entered directly ("manual"). Shared by the serializer
    (`get_source`), the list filter (`FinancialEntryFilter.filter_source`),
    and the chart breakdown below — never stored on the model itself."""
    return "labor" if has_time_entry else "manual"


def get_project_financial_entries(user, project_id):
    return FinancialEntry.objects.for_project(project_id).accessible_to(user).with_relations()


def get_project_deleted_financial_entries(user, project_id):
    return FinancialEntry.deleted_objects.for_project(project_id).accessible_to(user).with_relations()


def build_financial_entry_chart(entries, *, group_by, start_date, end_date):
    """Build totals/series/sources buckets from a FinancialEntry `.values()` queryset.

    `series` covers every period in `[start_date, end_date]`, not just the ones
    with entries — otherwise a chart over a wide range with sparse data would
    only show the handful of periods that happen to have activity instead of
    reading as a continuous timeline."""
    totals = _empty_bucket()
    series = OrderedDict()
    sources = {}

    if start_date and end_date:
        for period in _period_range(start_date, end_date, group_by):
            series[period] = _empty_bucket()

    for entry in entries:
        amount = Decimal(entry["amount"])
        period = _format_period(entry["created_at"], group_by)
        source = financial_entry_source(entry["time_entry"] is not None)

        _add_amount(totals, amount, entry["type"])
        _add_amount(series.setdefault(period, _empty_bucket()), amount, entry["type"])
        _add_amount(sources.setdefault(source, _empty_bucket()), amount, entry["type"])

    return {
        "group_by": group_by,
        "start_date": start_date,
        "end_date": end_date,
        "totals": _serialize_bucket(totals),
        "series": [
            {"period": period, **_serialize_bucket(bucket)}
            for period, bucket in sorted(series.items())
        ],
        "sources": [
            {"source": source, **_serialize_bucket(bucket)}
            for source, bucket in sorted(sources.items())
        ],
    }


def _period_range(start_date, end_date, group_by):
    """Every period key (inclusive) between two dates, in the same format
    `_format_period` produces, so gaps in `series` can be zero-filled."""
    if group_by == "day":
        periods = []
        current = start_date
        while current <= end_date:
            periods.append(current.isoformat())
            current += timedelta(days=1)
        return periods

    periods = []
    current = date(start_date.year, start_date.month, 1)
    last = date(end_date.year, end_date.month, 1)
    while current <= last:
        periods.append(f"{current.year:04d}-{current.month:02d}")
        current = date(current.year + 1, 1, 1) if current.month == 12 else date(current.year, current.month + 1, 1)
    return periods


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
