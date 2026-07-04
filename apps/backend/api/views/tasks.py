from django.db.models import Q
from django.shortcuts import get_object_or_404

import django_filters
from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import Task
from ..authorization import HasProjectPermission, PermissionCodeByMethodMixin
from ..serializers import TaskSerializer
from ..services.projects import get_accessible_projects
from ..services.tasks import get_project_deleted_tasks, get_project_tasks
from ..utils import FolderScopedFilterSet, StableOrderingFilter
from core.views import RestoreModelMixin, SoftDeleteDestroyMixin


class TaskFilter(FolderScopedFilterSet):
    exclude_done = django_filters.BooleanFilter(method="filter_exclude_done")
    # Both bounds only validate/parse the input here; the actual OR-across-columns
    # filtering happens once in `qs`, since it needs both values together.
    date_from = django_filters.DateFilter(method="noop")
    date_to = django_filters.DateFilter(method="noop")

    class Meta:
        model = Task
        fields = ["status", "priority", "created_by", "assigned_to"]

    def filter_exclude_done(self, queryset, _name, value):
        if value:
            return queryset.exclude(status="done")
        return queryset

    def noop(self, queryset, _name, _value):
        return queryset

    @property
    def qs(self):
        queryset = super().qs
        date_from = self.form.cleaned_data.get("date_from")
        date_to = self.form.cleaned_data.get("date_to")

        # A task matches if its start OR its end date falls within [date_from, date_to].
        if date_from and date_to:
            return queryset.filter(
                Q(start_date__gte=date_from, start_date__lte=date_to) |
                Q(end_date__gte=date_from, end_date__lte=date_to)
            )
        if date_from:
            return queryset.filter(Q(start_date__gte=date_from) | Q(end_date__gte=date_from))
        if date_to:
            return queryset.filter(Q(start_date__lte=date_to) | Q(end_date__lte=date_to))
        return queryset


@extend_schema(tags=["tasks"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les tâches d'un projet",
        description=(
            "Retourne toutes les tâches actives d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `status`, `priority`, `created_by`, `assigned_to`, `exclude_done`.\n\n"
            "- Filtre calendrier : `date_from`, `date_to` — retourne les tâches dont `start_date` OU `end_date` tombe dans la plage.\n\n"
            "- Recherche disponible : `search` sur `title` et `description`.\n\n"
            "- Tri disponible : `ordering` sur `title`, `folder__name`, `status_order`, `priority_order`, `end_date`, `created_at`. "
            "Préfixer avec `-` pour ordre descendant.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `task.view`."
        ),
    ),
    post=extend_schema(
        summary="Créer une tâche",
        description="Crée une nouvelle tâche dans un projet.\nPermission requise : `task.edit`.",
    ),
)
class TaskListCreateView(PermissionCodeByMethodMixin, generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {"GET": "task.view", "POST": "task.edit"}
    filter_backends = [DjangoFilterBackend, SearchFilter, StableOrderingFilter]
    filterset_class = TaskFilter
    search_fields = ["title", "description"]
    ordering_fields = ["title", "folder__name", "status_order", "priority_order", "end_date", "created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.objects.none()

        queryset = get_project_tasks(self.request.user, self.kwargs["project_id"])
        return queryset.with_ordering_annotations().order_by("end_date", "created_at", "id")

    def get_serializer_context(self):
        context = super().get_serializer_context()

        if getattr(self, "swagger_fake_view", False):
            return context

        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        context["project"] = project
        return context

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        serializer.save(project=project, created_by=self.request.user)


@extend_schema(tags=["tasks"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'une tâche",
        description="Retourne une tâche précise.\nPermission requise : `task.view`.",
    ),
    put=extend_schema(
        summary="Modifier une tâche",
        description="Modifie complètement une tâche.\nPermission requise : `task.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement une tâche",
        description="Modifie partiellement une tâche.\nPermission requise : `task.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer une tâche",
        description="Supprime une tâche via soft delete.\nPermission requise : `task.delete`.",
    ),
)
class TaskDetailView(SoftDeleteDestroyMixin, PermissionCodeByMethodMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {
        "GET": "task.view",
        "PUT": "task.edit",
        "PATCH": "task.edit",
        "DELETE": "task.delete",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.objects.none()

        return get_project_tasks(self.request.user, self.kwargs["project_id"])


@extend_schema(tags=["tasks"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les tâches supprimées",
        description=(
            "Retourne les tâches supprimées d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `status`, `priority`, `created_by`, `assigned_to`, `exclude_done`.\n\n"
            "- Filtre calendrier : `date_from`, `date_to` — retourne les tâches dont `start_date` OU `end_date` tombe dans la plage.\n\n"
            "- Recherche disponible : `search` sur `title` et `description`.\n\n"
            "- Tri disponible : `ordering` sur `title`, `folder__name`, `status_order`, `priority_order`, `end_date`, `created_at`. "
            "Préfixer avec `-` pour ordre descendant.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `task.restore`."
        ),
    )
)
class TaskTrashListView(generics.ListAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "task.restore"
    filter_backends = [DjangoFilterBackend, SearchFilter, StableOrderingFilter]
    filterset_class = TaskFilter
    search_fields = ["title", "description"]
    ordering_fields = ["title", "folder__name", "status_order", "priority_order", "end_date", "created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.deleted_objects.none()

        queryset = get_project_deleted_tasks(self.request.user, self.kwargs["project_id"])
        return queryset.with_ordering_annotations().order_by("end_date", "created_at", "id")


@extend_schema(tags=["tasks"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer une tâche",
        description="Restaure une tâche supprimée.\nPermission requise : `task.restore`.",
        request=None,
    )
)
class TaskRestoreView(RestoreModelMixin, generics.GenericAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "task.restore"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.deleted_objects.none()

        return get_project_deleted_tasks(self.request.user, self.kwargs["project_id"])
