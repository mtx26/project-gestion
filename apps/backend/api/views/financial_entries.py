from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import FinancialEntry
from ..permissions import HasProjectPermission
from ..serializers import FinancialEntrySerializer
from ..services.projects import get_accessible_projects


@extend_schema(tags=["finance"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les entrees financieres d'un projet",
        description=(
            "Retourne toutes les entrees financieres actives d'un projet.\n\n"
            "- Filtres disponibles : `folder`, `document`, `time_entry`, `type`, `category`, `created_by`.\n\n"
            "- Recherche disponible : `search` sur `category` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `finance.view`."
        ),
    ),
    post=extend_schema(
        summary="Creer une entree financiere",
        description="Cree une nouvelle entree financiere dans un projet.\nPermission requise : `finance.edit`.",
    ),
)
class FinancialEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = FinancialEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["folder", "document", "time_entry", "type", "category", "created_by"]
    search_fields = ["category", "description"]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "finance.view"
        elif self.request.method == "POST":
            self.permission_code = "finance.edit"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FinancialEntry.objects.none()

        return FinancialEntry.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "document",
            "time_entry",
            "created_by",
        ).order_by("-created_at", "-id")

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        serializer.save(project=project, created_by=self.request.user)


@extend_schema(tags=["finance"])
@extend_schema_view(
    get=extend_schema(
        summary="Detail d'une entree financiere",
        description="Retourne une entree financiere precise.\nPermission requise : `finance.view`.",
    ),
    put=extend_schema(
        summary="Modifier une entree financiere",
        description="Modifie completement une entree financiere.\nPermission requise : `finance.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement une entree financiere",
        description="Modifie partiellement une entree financiere.\nPermission requise : `finance.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer une entree financiere",
        description="Supprime une entree financiere via soft delete.\nPermission requise : `finance.delete`.",
    ),
)
class FinancialEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FinancialEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "finance.view"
        elif self.request.method in ["PUT", "PATCH"]:
            self.permission_code = "finance.edit"
        elif self.request.method == "DELETE":
            self.permission_code = "finance.delete"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FinancialEntry.objects.none()

        return FinancialEntry.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "document",
            "time_entry",
            "created_by",
        )

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)


@extend_schema(tags=["finance"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les entrees financieres supprimees",
        description=(
            "Retourne les entrees financieres supprimees d'un projet.\n\n"
            "- Filtres disponibles : `folder`, `document`, `time_entry`, `type`, `category`, `created_by`.\n\n"
            "- Recherche disponible : `search` sur `category` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `finance.view`."
        ),
    )
)
class FinancialEntryTrashListView(generics.ListAPIView):
    serializer_class = FinancialEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["folder", "document", "time_entry", "type", "category", "created_by"]
    search_fields = ["category", "description"]

    def get_permissions(self):
        self.permission_code = "finance.view"
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FinancialEntry.deleted_objects.none()

        return FinancialEntry.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "document",
            "time_entry",
            "created_by",
        ).order_by("-created_at", "-id")


@extend_schema(tags=["finance"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer une entree financiere",
        description="Restaure une entree financiere supprimee.\nPermission requise : `finance.restore`.",
        request=None,
    )
)
class FinancialEntryRestoreView(generics.GenericAPIView):
    serializer_class = FinancialEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "finance.restore"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FinancialEntry.deleted_objects.none()

        return FinancialEntry.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "document",
            "time_entry",
            "created_by",
        )

    def post(self, request, project_id, pk):
        financial_entry = self.get_object()

        financial_entry.restore()

        serializer = self.get_serializer(financial_entry)
        return Response(serializer.data)
