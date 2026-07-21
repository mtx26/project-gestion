from datetime import timedelta

from django.db.models import Q
from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema

from ..authorization import HasProjectPermission, ProjectAuthorization
from ..serializers import ProjectCalendarQuerySerializer
from ..services.projects import get_accessible_projects
from ..services.tasks import get_project_tasks
from ..services.time_entries import get_project_time_entries
from ..utils import get_user_display_name


def _format_duration_label(minutes: int) -> str:
    hours, mins = divmod(minutes, 60)
    return f"{hours}h" if mins == 0 else f"{hours}h{mins:02d}"


def _time_entry_event(entry) -> dict:
    """One calendar event per time entry, on its UTC calendar day (this app has no
    per-user timezone — `TIME_ZONE = 'UTC'` and nothing ever activates another one —
    so the entry's stored UTC date *is* its canonical calendar day)."""
    duration_label = _format_duration_label(entry.duration_minutes)
    title = " · ".join(filter(None, [duration_label, entry.description or get_user_display_name(entry.user)]))

    remaining = entry.get_remaining_amount()
    paid = entry.get_paid_amount()
    if remaining <= 0:
        pay_status = "paid"
    elif paid > 0:
        pay_status = "partial"
    else:
        pay_status = "unpaid"

    return {
        "id": f"time-{entry.id}",
        "kind": "time",
        "title": title,
        "start": entry.start_date.date().isoformat(),
        "end": None,
        "entity_id": entry.id,
        "status": None,
        "priority": None,
        "pay_status": pay_status,
        "duration_label": duration_label,
    }


def _task_event(task) -> dict:
    """One calendar event per task: a span if both dates are set (`end` is the
    exclusive upper bound, computed here with plain `date` arithmetic — no client-side
    string parsing of an ISO datetime, which is what silently broke multi-day spans
    before this endpoint existed), otherwise a single-day marker on whichever date
    the task has."""
    base = {
        "entity_id": task.id,
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
        "pay_status": None,
        "duration_label": None,
    }

    if task.start_date and task.end_date:
        return {
            **base,
            "id": f"task-{task.id}",
            "kind": "task-span",
            "start": task.start_date.date().isoformat(),
            "end": (task.end_date.date() + timedelta(days=1)).isoformat(),
        }
    if task.start_date:
        return {
            **base,
            "id": f"task-start-{task.id}",
            "kind": "task-point-start",
            "start": task.start_date.date().isoformat(),
            "end": None,
        }
    return {
        **base,
        "id": f"task-due-{task.id}",
        "kind": "task-point-due",
        "start": task.end_date.date().isoformat(),
        "end": None,
    }


@extend_schema(
    tags=["calendar"],
    summary="Evenements calendrier d'un projet",
    description=(
        "Retourne, pour la plage `start_date`/`end_date` (bornes incluses), les evenements "
        "calendrier du projet (taches + entrees de temps) deja fusionnes, tries et formates — "
        "en une seule reponse non paginee, la grille ayant besoin de tout l'existant sur la "
        "periode plutot que d'une page.\n\n"
        "Chaque evenement a la forme `{id, kind, title, start, end, entity_id, status, priority, "
        "pay_status, duration_label}` :\n"
        "- `kind` : `time`, `task-span`, `task-point-start` ou `task-point-due`.\n"
        "- `start`/`end` sont des dates simples (`YYYY-MM-DD`) ; `end` est la borne exclusive "
        "d'une tache span, `null` sinon.\n"
        "- `status`/`priority` (taches) et `pay_status`/`duration_label` (temps) sont `null` "
        "quand non pertinents pour le type d'evenement.\n\n"
        "Les entrees de temps sont toujours incluses, y compris payees (contrairement a "
        "`/time-entries/`, qui les masque par defaut) — le calendrier n'a pas de notion de "
        "filtre de paiement.\n\n"
        "`include_tasks`/`include_time` (bool, defaut `true`) permettent de n'en demander qu'une "
        "des deux categories. Chaque categorie n'est de toute facon renvoyee que si l'utilisateur "
        "a la permission correspondante (`task.view` / `time_entry.view`) ; sinon elle est vide "
        "plutot que de faire echouer toute la requete."
    ),
)
class ProjectCalendarView(generics.GenericAPIView):
    """No single `permission_code`: a project member with only one of `task.view` /
    `time_entry.view` should still get that half of the response, not a 403 for the
    whole thing. `HasProjectPermission` with no `permission_code` only checks project
    membership; the per-section gating happens here via `ProjectAuthorization`."""

    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get(self, request, project_id):
        project = get_object_or_404(get_accessible_projects(request.user), pk=project_id)

        query_serializer = ProjectCalendarQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        start_date = query_serializer.validated_data["start_date"]
        end_date = query_serializer.validated_data["end_date"]
        include_tasks = query_serializer.validated_data["include_tasks"]
        include_time = query_serializer.validated_data["include_time"]

        auth = ProjectAuthorization(request.user, project)
        events = []

        if include_time and auth.has("time_entry.view"):
            time_entries = get_project_time_entries(request.user, project_id).filter(
                start_date__date__gte=start_date, start_date__date__lte=end_date,
            ).order_by("-start_date", "-id")
            events.extend(_time_entry_event(entry) for entry in time_entries)

        if include_tasks and auth.has("task.view"):
            # Plain `__gte`/`__lt` (no `__date` cast): Task.start_date/end_date are
            # nullable, and casting a NULL DateTimeField through SQLite's `__date`
            # transform raises "user-defined function raised exception" on this
            # backend. `end_date_exclusive` keeps the upper bound inclusive of the
            # whole `end_date` day despite comparing datetimes.
            end_date_exclusive = end_date + timedelta(days=1)
            tasks = get_project_tasks(request.user, project_id).filter(
                Q(start_date__lt=end_date_exclusive, end_date__gte=start_date)
                | Q(end_date__isnull=True, start_date__gte=start_date, start_date__lt=end_date_exclusive)
                | Q(start_date__isnull=True, end_date__gte=start_date, end_date__lt=end_date_exclusive)
            ).order_by("start_date", "end_date", "id")
            events.extend(_task_event(task) for task in tasks)

        # Time entries first: on a day with many overlapping tasks, a lone time entry
        # would otherwise be sorted behind them by FullCalendar's own ordering (by
        # duration) and end up hidden behind the "+N more" link — see eventOrder in
        # project-calendar-view.tsx, which trusts this ordering instead of
        # recomputing it.
        events.sort(key=lambda e: 0 if e["kind"] == "time" else 1)

        return Response({"events": events})
