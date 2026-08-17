from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Count, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404

from ..models import FinancialEntry, Project, TimeEntry


def get_project_time_entries_base(user, project_id):
    """Active entries, scoped + optimized, with no permission restriction and no
    financial annotation. Used by endpoints whose access rule differs from the list
    view's (`TimeEntryDetailView` restricts only on GET; `TimeEntryPaymentView` doesn't
    restrict at all — see `HasProjectPermission`/`time_entry.pay`)."""
    return TimeEntry.objects.for_project(project_id).accessible_to(user).with_relations()


def get_project_deleted_time_entries_base(user, project_id):
    """Same as `get_project_time_entries_base` but for soft-deleted entries."""
    return TimeEntry.deleted_objects.for_project(project_id).accessible_to(user).with_relations()


def get_project_time_entries(user, project_id, permission_code):
    """Base queryset for the active `/time-entries/` endpoints: scoped to
    `project_id`, restricted to the user's own entries unless they hold
    `permission_code`, and annotated for `TimeEntryFilter` (payment_status).
    Callers pass the permission that matches what they expose:
    `time_entry.view_others_detail` for the list/detail endpoints, `time_entry.view_all`
    for the `/stats/` endpoint — two independent axes (see `TimeEntryQuerySet.own_unless_has_permission`)."""
    project = get_object_or_404(Project.objects.accessible_to(user), pk=project_id)
    queryset = get_project_time_entries_base(user, project_id).own_unless_has_permission(user, project, permission_code)
    return queryset.with_financial_totals()


def get_project_deleted_time_entries(user, project_id):
    """Same as `get_project_time_entries` but for the trash endpoint, which
    has no `time_entry.view_all` restriction (gated by `time_entry.restore` instead)."""
    return get_project_deleted_time_entries_base(user, project_id).with_financial_totals()


def _format_totals(duration_minutes, total_cost, total_paid, entry_count) -> dict:
    """Clamps `remaining` at zero and quantizes every amount to cents — shared
    formatting used by both the project-wide stats and the per-user breakdown."""
    total_cost = total_cost or Decimal("0.00")
    total_paid = total_paid or Decimal("0.00")
    remaining = max(total_cost - total_paid, Decimal("0.00"))
    return {
        "duration_minutes": duration_minutes or 0,
        "cost_amount": str(total_cost.quantize(Decimal("0.01"))),
        "paid_amount": str(total_paid.quantize(Decimal("0.01"))),
        "remaining_amount": str(remaining.quantize(Decimal("0.01"))),
        "entry_count": entry_count or 0,
    }


def _sum_totals_kwargs() -> dict:
    """Shared `.aggregate()`/`.annotate()` kwargs for duration/cost/paid/count sums —
    used for both the project-wide total and the per-user `GROUP BY`. Safe to re-sum
    `filter_paid_amount` under a `GROUP BY` because it's a `Subquery`-based annotation
    (see `TimeEntryQuerySet.with_financial_totals`), not a plain joined `Sum`."""
    return {
        "duration_minutes": Coalesce(Sum("duration_minutes"), Value(0)),
        "total_cost": Coalesce(Sum("filter_cost_amount"), Value(Decimal("0.00"))),
        "total_paid": Coalesce(Sum("filter_paid_amount"), Value(Decimal("0.00"))),
        "entry_count": Count("id"),
    }


def compute_time_entry_stats(queryset) -> dict:
    """Project-wide totals plus a per-user breakdown (`by_user`, for the Synthese
    panel — shows each member's aggregate without exposing their individual entries,
    which requires `time_entry.view_others_detail` separately, enforced at the
    list/detail queryset level, not here).

    Les entrees orphelines (`user` a NULL, laissees par un compte supprime — le champ est
    en `SET_NULL`) forment leur propre ligne `user: null` : les exclure ferait un
    `by_user` dont la somme ne retombe pas sur le total global, donc un "reste a payer"
    superieur a ce qui est reellement attribuable a quelqu'un."""
    grand_total = queryset.aggregate(**_sum_totals_kwargs())
    by_user = (
        queryset
        .values("user")
        .annotate(**_sum_totals_kwargs())
        .order_by("user")
    )
    return {
        **_format_totals(**grand_total),
        "by_user": [{"user": row.pop("user"), **_format_totals(**row)} for row in by_user],
    }


def compute_time_entries_remaining_amount(queryset) -> Decimal:
    """Reste a payer agrege sur `queryset` — meme calcul (et meme clamp a zero) que le
    `remaining_amount` renvoye par le endpoint de stats, pour que le montant maximum
    accepte par le paiement groupe corresponde exactement au total affiche."""
    return Decimal(_format_totals(**queryset.aggregate(**_sum_totals_kwargs()))["remaining_amount"])


def pay_time_entries_oldest_first(queryset, amount, actor) -> dict:
    """Repartit `amount` sur les entrees de `queryset`, de la plus ancienne a la plus
    recente : chaque entree est soldee entierement tant que le montant restant le
    permet, seule la derniere servie pouvant l'etre partiellement.

    Cree une `FinancialEntry` de type EXPENSE par entree servie — la meme ecriture que
    le paiement unitaire (`TimeEntryPaymentSerializer.create`), pour que les deux
    chemins produisent un historique financier identique. L'appelant garantit en amont
    que `amount` ne depasse pas le reste a payer du scope (voir
    `TimeEntryBulkPaymentSerializer.validate`)."""
    unallocated = amount
    paid_entry_count = 0
    partial_entry_count = 0

    with transaction.atomic():
        for time_entry in queryset.order_by("start_date", "id"):
            if unallocated <= Decimal("0.00"):
                break

            entry_remaining = time_entry.get_remaining_amount()
            allocated = min(entry_remaining, unallocated).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if allocated <= Decimal("0.00"):
                continue

            FinancialEntry.objects.create(
                project=time_entry.project,
                time_entry=time_entry,
                created_by=actor,
                amount=allocated,
                type=FinancialEntry.FinancialType.EXPENSE,
            )

            unallocated -= allocated
            if allocated >= entry_remaining:
                paid_entry_count += 1
            else:
                partial_entry_count += 1

    return {
        "paid_amount": str((amount - unallocated).quantize(Decimal("0.01"))),
        "paid_entry_count": paid_entry_count,
        "partial_entry_count": partial_entry_count,
    }
