from datetime import date, timedelta

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone

from icalendar import Calendar, Event as IcsEvent

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from ..authorization import HasProjectPermission, ProjectAuthorization
from ..models import ProjectCalendarSubscription
from ..serializers import (
    ProjectCalendarQuerySerializer,
    ProjectCalendarSubscriptionSerializer,
    ProjectCalendarSubscriptionWriteSerializer,
)
from ..services.calendar import create_or_update_calendar_subscription, get_calendar_subscription
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
    title = " · ".join(filter(None, [
        duration_label,
        entry.title or entry.description or get_user_display_name(entry.user),
    ]))

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
        "Les entrees de temps sont toujours incluses, y compris payees : le calendrier n'a "
        "pas de notion de filtre de paiement (`pay_status` est renvoye pour la coloration).\n\n"
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
            # `time_entry.view_others_detail` comme la liste : le calendrier affiche des
            # entrees individuelles (duree, description, titulaire), pas un agrege — sans
            # cette permission, seules celles de l'utilisateur connecte sont visibles.
            time_entries = get_project_time_entries(
                request.user, project_id, "time_entry.view_others_detail",
            ).filter(
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


def _ics_event(event: dict, project_id: int) -> IcsEvent:
    """Reuses the same event dicts as the web calendar (`_time_entry_event`/
    `_task_event`) so the ICS feed can never drift from what `/calendar/` shows —
    only the serialization format differs."""
    ics_event = IcsEvent()
    ics_event.add("uid", f"{event['id']}-project{project_id}@project-gestion")
    ics_event.add("summary", event["title"])
    ics_event.add("dtstamp", timezone.now())

    start = date.fromisoformat(event["start"])
    end = date.fromisoformat(event["end"]) if event["end"] else start + timedelta(days=1)
    ics_event.add("dtstart", start)
    ics_event.add("dtend", end)

    description = "\n".join(filter(None, [
        f"Statut : {event['status']}" if event["status"] else None,
        f"Priorite : {event['priority']}" if event["priority"] else None,
        f"Paiement : {event['pay_status']}" if event["pay_status"] else None,
    ]))
    if description:
        ics_event.add("description", description)

    return ics_event


@extend_schema(
    tags=["calendar"],
    summary="Souscription calendrier (lien ICS) de l'utilisateur pour un projet",
    description=(
        "Gere le lien d'abonnement ICS (`webcal`) de l'utilisateur connecte pour ce "
        "projet — un seul par (projet, utilisateur).\n\n"
        "- `GET` retourne la souscription existante (404 si aucune).\n"
        "- `POST` cree la souscription si absente, sinon met a jour `include_tasks`/"
        "`include_time` sans changer le `token` deja distribue aux applications de "
        "calendrier.\n"
        "- `DELETE` revoque la souscription (le lien existant cesse de fonctionner).\n\n"
        "Le flux lui-meme est servi sans authentification sur `/api/calendar/<token>.ics` "
        "— l'acces y est reevalue a chaque requete via les permissions "
        "`task.view`/`time_entry.view` de l'utilisateur qui a cree la souscription."
    ),
)
class ProjectCalendarSubscriptionView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, HasProjectPermission]
    serializer_class = ProjectCalendarSubscriptionSerializer

    def get(self, request, project_id):
        get_object_or_404(get_accessible_projects(request.user), pk=project_id)
        subscription = get_calendar_subscription(request.user, project_id)
        if subscription is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(self.get_serializer(subscription).data)

    def post(self, request, project_id):
        project = get_object_or_404(get_accessible_projects(request.user), pk=project_id)

        write_serializer = ProjectCalendarSubscriptionWriteSerializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)

        subscription = create_or_update_calendar_subscription(
            project=project,
            user=request.user,
            include_tasks=write_serializer.validated_data["include_tasks"],
            include_time=write_serializer.validated_data["include_time"],
        )

        return Response(self.get_serializer(subscription).data)

    def delete(self, request, project_id):
        get_object_or_404(get_accessible_projects(request.user), pk=project_id)
        subscription = get_calendar_subscription(request.user, project_id)
        if subscription is not None:
            subscription.soft_delete(request.user)

        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=["calendar"],
    summary="Flux ICS public d'une souscription calendrier",
    description=(
        "Flux `text/calendar` non authentifie, identifie par le `token` secret de la "
        "souscription — pense pour etre colle tel quel dans Google Calendar/Outlook/"
        "Apple Calendar. Les evenements retournes sont ceux que l'utilisateur ayant "
        "cree la souscription peut voir *au moment de la requete* (permissions "
        "reevaluees a chaque appel, aucune date de peremption fixe)."
    ),
)
class ProjectCalendarFeedView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        subscription = get_object_or_404(
            ProjectCalendarSubscription.objects.select_related("project", "user"),
            token=token,
        )
        project = subscription.project
        user = subscription.user
        auth = ProjectAuthorization(user, project)

        events = []
        if subscription.include_time and auth.has("time_entry.view"):
            time_entries = get_project_time_entries(user, project.id).order_by("-start_date", "-id")
            events.extend(_time_entry_event(entry) for entry in time_entries)

        if subscription.include_tasks and auth.has("task.view"):
            # Unlike `/calendar/`, this feed has no date range to implicitly exclude
            # dateless tasks (its `Q(...)` filters all require at least one date field
            # to fall in range) — exclude them explicitly instead, since `_task_event`
            # requires at least one of `start_date`/`end_date` to be set.
            tasks = get_project_tasks(user, project.id).exclude(
                start_date__isnull=True, end_date__isnull=True,
            ).order_by("start_date", "end_date", "id")
            events.extend(_task_event(task) for task in tasks)

        calendar = Calendar()
        calendar.add("prodid", f"-//project-gestion//project-{project.id}//FR")
        calendar.add("version", "2.0")
        calendar.add("calscale", "GREGORIAN")
        calendar.add("method", "PUBLISH")
        calendar.add("x-wr-calname", project.name)
        for event in events:
            calendar.add_component(_ics_event(event, project.id))

        response = HttpResponse(calendar.to_ical(), content_type="text/calendar; charset=utf-8")
        response["Content-Disposition"] = f'inline; filename="{project.id}.ics"'
        return response
