from django.db.models import Q
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


class TaskFilter(django_filters.FilterSet):
    folder = django_filters.NumberFilter(method="filter_folder")
    # Filtres de plage individuels
    start_date_after = django_filters.DateFilter(field_name="start_date", lookup_expr="gte")
    start_date_before = django_filters.DateFilter(field_name="start_date", lookup_expr="lte")
    due_date_after = django_filters.DateFilter(field_name="due_date", lookup_expr="gte")
    due_date_before = django_filters.DateFilter(field_name="due_date", lookup_expr="lte")

    class Meta:
        model = Task
        fields = ["status", "priority", "due_date", "created_by", "assigned_to"]

    def filter_folder(self, queryset, name, value):
        project_id = self.request.parser_context["kwargs"].get("project_id")
        if not project_id:
            return queryset
        folder_ids = get_descendant_folder_ids(value, project_id)
        return queryset.filter(folder_id__in=folder_ids)


def apply_task_date_range(queryset, request):
    """
    Filtre OR combiné : retourne les tâches dont start_date OU due_date
    tombe dans [date_from, date_to]. Utilisé par le calendrier.
    """
    date_from = parse_date(request.query_params.get("date_from") or "")
    date_to = parse_date(request.query_params.get("date_to") or "")

    if not date_from and not date_to:
        return queryset

    if date_from and date_to:
        q = (
            Q(start_date__gte=date_from, start_date__lte=date_to) |
            Q(due_date__gte=date_from, due_date__lte=date_to)
        )
    elif date_from:
        q = Q(start_date__gte=date_from) | Q(due_date__gte=date_from)
    else:
        q = Q(start_date__lte=date_to) | Q(due_date__lte=date_to)

    return queryset.filter(q)


@extend_schema(tags=["tasks"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les taches d'un projet",
        description=(
            "Retourne toutes les taches actives d'un projet.\n\n"
            "- Filtres disponibles : `folder`, `status`, `priority`, "
            "`due_date`, `created_by`, `assigned_to`.\n\n"
            "- Recherche disponible : `search` sur `title` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `task.view`."
        ),
    ),
    post=extend_schema(
        summary="Creer une tache",
        description="Cree une nouvelle tache dans un projet.\nPermission requise : `task.edit`.",
    ),
)
class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = TaskFilter
    search_fields = ["title", "description"]

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
        ).select_related(
            "project",
            "folder",
            "created_by",
        ).prefetch_related(
            "assigned_to",
        ).order_by("due_date", "created_at", "id")

        return apply_task_date_range(queryset, self.request)

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
        summary="Detail d'une tache",
        description="Retourne une tache precise.\nPermission requise : `task.view`.",
    ),
    put=extend_schema(
        summary="Modifier une tache",
        description="Modifie completement une tache.\nPermission requise : `task.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement une tache",
        description="Modifie partiellement une tache.\nPermission requise : `task.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer une tache",
        description="Supprime une tache via soft delete.\nPermission requise : `task.delete`.",
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
        summary="Lister les taches supprimees",
        description=(
            "Retourne les taches supprimees d'un projet.\n\n"
            "- Filtres disponibles : `folder`, `status`, `priority`, "
            "`due_date`, `created_by`, `assigned_to`.\n\n"
            "- Recherche disponible : `search` sur `title` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `task.view`."
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
        ).order_by("due_date", "created_at", "id")

        return apply_task_date_range(queryset, self.request)


@extend_schema(tags=["tasks"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer une tache",
        description="Restaure une tache supprimee.\nPermission requise : `task.restore`.",
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
