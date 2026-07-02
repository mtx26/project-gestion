from django.shortcuts import get_object_or_404

import django_filters
from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import FinancialEntry
from ..permissions import HasProjectPermission
from ..serializers import (
    FinancialEntryChartQuerySerializer,
    FinancialEntryChartSerializer,
    FinancialEntrySerializer,
)
from ..services.financial_entries import build_financial_entry_chart
from ..services.projects import get_accessible_projects
from ..utils import FolderScopedFilterMixin, StableOrderingFilter
from core.views import RestoreModelMixin, SoftDeleteDestroyMixin


class FinancialEntryFilter(FolderScopedFilterMixin, django_filters.FilterSet):
    folder = django_filters.NumberFilter(method="filter_folder")
    date_from = django_filters.DateFilter(field_name="created_at__date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="created_at__date", lookup_expr="lte")

    class Meta:
        model = FinancialEntry
        fields = ["type", "created_by"]


@extend_schema(tags=["finance"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les entrées financières d'un projet",
        description=(
            "Retourne toutes les entrées financières actives d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `type`, `created_by`.\n\n"
            "- Recherche disponible : `search` sur `category` et `description`.\n\n"
            "- Tri disponible : `ordering` sur `amount`, `created_at`. Préfixer avec `-` pour ordre descendant.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `finance.view`."
        ),
    ),
    post=extend_schema(
        summary="Créer une entrée financière",
        description="Crée une nouvelle entrée financière dans un projet.\nPermission requise : `finance.edit`.",
    ),
)
class FinancialEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = FinancialEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, StableOrderingFilter]
    filterset_class = FinancialEntryFilter
    search_fields = ["category", "description"]
    ordering_fields = ["amount", "created_at"]

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
            "time_entry__user",
            "task",
            "created_by",
        ).prefetch_related("documents").order_by("-created_at", "-id")

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        serializer.save(project=project, created_by=self.request.user)


@extend_schema(tags=["finance"])
@extend_schema_view(
    get=extend_schema(
        summary="Données de graphique financier d'un projet",
        description=(
            "Retourne les totaux financiers actifs d'un projet, une série temporelle "
            "et une répartition par catégorie.\n\n"
            "- Paramètres disponibles : `group_by=month|day`, `start_date`, `end_date`.\n\n"
            "- Permission requise : `finance.view`."
        ),
        parameters=[FinancialEntryChartQuerySerializer],
        responses=FinancialEntryChartSerializer,
    )
)
class FinancialEntryChartView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "finance.view"
    serializer_class = FinancialEntryChartSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FinancialEntry.objects.none()

        return FinancialEntry.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        )

    def get(self, request, project_id):
        query_serializer = FinancialEntryChartQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        filters = query_serializer.validated_data

        entries = self.get_queryset()
        if "start_date" in filters:
            entries = entries.filter(created_at__date__gte=filters["start_date"])
        if "end_date" in filters:
            entries = entries.filter(created_at__date__lte=filters["end_date"])

        chart_data = build_financial_entry_chart(
            entries.order_by("created_at", "id").values(
                "amount",
                "category",
                "created_at",
                "type",
            ),
            group_by=filters["group_by"],
            start_date=filters.get("start_date"),
            end_date=filters.get("end_date"),
        )

        return Response(chart_data)


@extend_schema(tags=["finance"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'une entrée financière",
        description="Retourne une entrée financière précise.\nPermission requise : `finance.view`.",
    ),
    put=extend_schema(
        summary="Modifier une entrée financière",
        description="Modifie complètement une entrée financière.\nPermission requise : `finance.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement une entrée financière",
        description="Modifie partiellement une entrée financière.\nPermission requise : `finance.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer une entrée financière",
        description="Supprime une entrée financière via soft delete.\nPermission requise : `finance.delete`.",
    ),
)
class FinancialEntryDetailView(SoftDeleteDestroyMixin, generics.RetrieveUpdateDestroyAPIView):
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
            "time_entry",
            "task",
            "created_by",
        ).prefetch_related("documents")


@extend_schema(tags=["finance"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les entrées financières supprimées",
        description=(
            "Retourne les entrées financières supprimées d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `type`, `created_by`.\n\n"
            "- Recherche disponible : `search` sur `category` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `finance.restore`."
        ),
    )
)
class FinancialEntryTrashListView(generics.ListAPIView):
    serializer_class = FinancialEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = FinancialEntryFilter
    search_fields = ["category", "description"]

    def get_permissions(self):
        self.permission_code = "finance.restore"
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
            "time_entry",
            "task",
            "created_by",
        ).prefetch_related("documents").order_by("-created_at", "-id")


@extend_schema(tags=["finance"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer une entrée financière",
        description="Restaure une entrée financière supprimée.\nPermission requise : `finance.restore`.",
        request=None,
    )
)
class FinancialEntryRestoreView(RestoreModelMixin, generics.GenericAPIView):
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
            "time_entry",
            "task",
            "created_by",
        ).prefetch_related("documents")
