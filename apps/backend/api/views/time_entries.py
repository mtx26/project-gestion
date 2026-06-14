from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import TimeEntry
from ..permissions import HasProjectPermission
from ..serializers import TimeEntrySerializer
from ..services.permissions import has_project_permission
from ..services.projects import get_accessible_projects


@extend_schema(tags=["time entries"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les entrees de temps d'un projet",
        description=(
            "Retourne toutes les entrees de temps actives d'un projet.\n\n"
            "- Filtres disponibles : `folder`, `task`, `user`.\n\n"
            "- Recherche disponible : `search` sur `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `time_entry.view`."
        ),
    ),
    post=extend_schema(
        summary="Creer une entree de temps",
        description="Cree une nouvelle entree de temps dans un projet.\nPermission requise : `time_entry.edit`.",
    ),
)
class TimeEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["folder", "task", "user"]
    search_fields = ["description"]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = None
        elif self.request.method == "POST":
            self.permission_code = "time_entry.edit"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimeEntry.objects.none()

        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        queryset = TimeEntry.objects.filter(
            project_id=self.kwargs["project_id"],
        ).select_related(
            "project",
            "folder",
            "task",
            "user",
        ).prefetch_related(
            "financial_entries",
        ).order_by("-created_at", "-id")

        if not has_project_permission(self.request.user, project, "time_entry.view"):
            queryset = queryset.filter(user=self.request.user)

        return queryset

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        serializer.save(project=project)


@extend_schema(tags=["time entries"])
@extend_schema_view(
    get=extend_schema(
        summary="Detail d'une entree de temps",
        description="Retourne une entree de temps precise.\nPermission requise : `time_entry.view`.",
    ),
    put=extend_schema(
        summary="Modifier une entree de temps",
        description="Modifie completement une entree de temps.\nPermission requise : `time_entry.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement une entree de temps",
        description="Modifie partiellement une entree de temps.\nPermission requise : `time_entry.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer une entree de temps",
        description="Supprime une entree de temps via soft delete.\nPermission requise : `time_entry.delete`.",
    ),
)
class TimeEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "time_entry.view"
        elif self.request.method in ["PUT", "PATCH"]:
            self.permission_code = "time_entry.edit"
        elif self.request.method == "DELETE":
            self.permission_code = "time_entry.delete"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimeEntry.objects.none()

        return TimeEntry.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "task",
            "user",
        ).prefetch_related(
            "financial_entries",
        )

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)


@extend_schema(tags=["time entries"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les entrees de temps supprimees",
        description=(
            "Retourne les entrees de temps supprimees d'un projet.\n\n"
            "- Filtres disponibles : `folder`, `task`, `user`.\n\n"
            "- Recherche disponible : `search` sur `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `time_entry.view`."
        ),
    )
)
class TimeEntryTrashListView(generics.ListAPIView):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["folder", "task", "user"]
    search_fields = ["description"]

    def get_permissions(self):
        self.permission_code = "time_entry.view"
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimeEntry.deleted_objects.none()

        return TimeEntry.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "task",
            "user",
        ).prefetch_related(
            "financial_entries",
        ).order_by("-created_at", "-id")


@extend_schema(tags=["time entries"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer une entree de temps",
        description="Restaure une entree de temps supprimee.\nPermission requise : `time_entry.restore`.",
        request=None,
    )
)
class TimeEntryRestoreView(generics.GenericAPIView):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "time_entry.restore"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimeEntry.deleted_objects.none()

        return TimeEntry.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "task",
            "user",
        ).prefetch_related(
            "financial_entries",
        )

    def post(self, request, project_id, pk):
        time_entry = self.get_object()

        time_entry.restore()

        serializer = self.get_serializer(time_entry)
        return Response(serializer.data)
