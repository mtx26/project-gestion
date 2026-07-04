from decimal import Decimal

from django.shortcuts import get_object_or_404

from ..models import Project, TimeEntry


def get_project_time_entries_base(user, project_id):
    """Active entries, scoped + optimized, with no permission restriction and no
    financial annotation. Used by endpoints whose access rule differs from the list
    view's (`TimeEntryDetailView` restricts only on GET; `TimeEntryPaymentView` doesn't
    restrict at all — see `HasProjectPermission`/`time_entry.pay`)."""
    return TimeEntry.objects.for_project(project_id).accessible_to(user).with_relations()


def get_project_deleted_time_entries_base(user, project_id):
    """Same as `get_project_time_entries_base` but for soft-deleted entries."""
    return TimeEntry.deleted_objects.for_project(project_id).accessible_to(user).with_relations()


def get_project_time_entries(user, project_id):
    """Base queryset for the active `/time-entries/` endpoints: scoped to
    `project_id`, restricted to the user's own entries unless they hold
    `time_entry.view_all`, and annotated for `TimeEntryFilter` (payment_status,
    include_paid) and for `compute_time_entry_stats`."""
    project = get_object_or_404(Project.objects.accessible_to(user), pk=project_id)
    queryset = get_project_time_entries_base(user, project_id).own_unless_can_view_all(user, project)
    return queryset.with_financial_totals()


def get_project_deleted_time_entries(user, project_id):
    """Same as `get_project_time_entries` but for the trash endpoint, which
    has no `time_entry.view_all` restriction (gated by `time_entry.restore` instead)."""
    return get_project_deleted_time_entries_base(user, project_id).with_financial_totals()


def compute_time_entry_stats(queryset) -> dict:
    """Turns the raw aggregate (`TimeEntryQuerySet.financial_totals`) into a response
    payload: clamps `remaining` at zero and quantizes every amount to cents — the
    business-rule/formatting part that belongs in the service, not the queryset."""
    result = queryset.financial_totals()
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
