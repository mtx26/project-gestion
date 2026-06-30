from django.db.models import Case, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date

import django_filters
from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import Task
from ..permissions import HasProjectPermission
from ..serializers import TaskSerializer
from ..services.folders import get_descendant_folder_ids
from ..services.projects import get_accessible_projects
from ..utils import StableOrderingFilter


class TaskFilter(django_filters.FilterSet):
    folder = django_filters.NumberFilter(method="filter_folder")
    exclude_done = django_filters.BooleanFilter(method="filter_exclude_done")
    date_from = django_filters.DateFilter(method="filter_date_from")
    date_to = django_filters.DateFilter(method="filter_date_to")

    class Meta:
        model = Task
        fields = ["status", "priority", "created_by", "assigned_to"]

    def filter_folder(self, queryset, name, value):
        project_id = self.request.parser_context["kwargs"].get("project_id")
        if not project_id:
            return queryset
        folder_ids = get_descendant_folder_ids(value, project_id)
        return queryset.filter(folder_id__in=folder_ids)

    def filter_exclude_done(self, queryset, _name, value):
        if value:
            return queryset.exclude(status="done")
        return queryset

    def filter_date_from(self, queryset, _name, value):
        date_to = parse_date(self.data.get("date_to") or "")
        if date_to:
            return queryset.filter(
                Q(start_date__gte=value, start_date__lte=date_to) |
                Q(end_date__gte=value, end_date__lte=date_to)
            )
        return queryset.filter(Q(start_date__gte=value) | Q(end_date__gte=value))

    def filter_date_to(self, queryset, _name, value):
        if self.data.get("date_from"):
            return queryset  # logique déjà appliquée par filter_date_from
        return queryset.filter(Q(start_date__lte=value) | Q(end_date__lte=value))


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
class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, StableOrderingFilter]
    filterset_class = TaskFilter
    search_fields = ["title", "description"]
    ordering_fields = ["title", "folder__name", "status_order", "priority_order", "end_date", "created_at"]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "task.view"
        elif self.request.method == "POST":
            self.permission_code = "task.edit"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.objects.none()

        queryset = Task.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).annotate(
            status_order=Case(
                When(status="todo", then=Value(0)),
                When(status="in_progress", then=Value(1)),
                When(status="done", then=Value(2)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            priority_order=Case(
                When(priority="low", then=Value(0)),
                When(priority="normal", then=Value(1)),
                When(priority="high", then=Value(2)),
                default=Value(1),
                output_field=IntegerField(),
            ),
        ).select_related(
            "project",
            "folder",
            "created_by",
        ).prefetch_related(
            "assigned_to",
        ).order_by("end_date", "created_at", "id")

        return queryset

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
class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "task.view"
        elif self.request.method in ["PUT", "PATCH"]:
            self.permission_code = "task.edit"
        elif self.request.method == "DELETE":
            self.permission_code = "task.delete"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.objects.none()

        return Task.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "created_by",
        ).prefetch_related(
            "assigned_to",
        )

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)


@extend_schema(tags=["tasks"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les tâches supprimées",
        description=(
            "Retourne les tâches supprimées d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `status`, `priority`, `created_by`, `assigned_to`, `exclude_done`.\n\n"
            "- Filtre calendrier : `date_from`, `date_to` — retourne les tâches dont `start_date` OU `end_date` tombe dans la plage.\n\n"
            "- Recherche disponible : `search` sur `title` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `task.restore`."
        ),
    )
)
class TaskTrashListView(generics.ListAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = TaskFilter
    search_fields = ["title", "description"]

    def get_permissions(self):
        self.permission_code = "task.restore"
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.deleted_objects.none()

        queryset = Task.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "created_by",
        ).prefetch_related(
            "assigned_to",
        ).order_by("end_date", "created_at", "id")

        return queryset


@extend_schema(tags=["tasks"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer une tâche",
        description="Restaure une tâche supprimée.\nPermission requise : `task.restore`.",
        request=None,
    )
)
class TaskRestoreView(generics.GenericAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "task.restore"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.deleted_objects.none()

        return Task.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "created_by",
        ).prefetch_related(
            "assigned_to",
        )

    def post(self, request, project_id, pk):
        task = self.get_object()

        task.restore()

        serializer = self.get_serializer(task)
        return Response(serializer.data)
