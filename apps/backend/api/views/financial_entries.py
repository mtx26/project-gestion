from collections import OrderedDict
from decimal import Decimal

from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics, serializers
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
from ..services.projects import get_accessible_projects


ZERO_MONEY = Decimal("0.00")
MONEY_QUANTIZE = Decimal("0.01")


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
    filterset_fields = ["folder", "time_entry", "type", "category", "created_by"]
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
            "time_entry__user",
            "task",
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
        summary="Donnees de graphique financier d'un projet",
        description=(
            "Retourne les totaux financiers actifs d'un projet, une serie temporelle "
            "et une repartition par categorie.\n\n"
            "- Parametres disponibles : `group_by=month|day`, `start_date`, `end_date`.\n\n"
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

        chart_data = self._build_chart_data(
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

    def _build_chart_data(self, entries, group_by, start_date, end_date):
        totals = self._empty_bucket()
        series = OrderedDict()
        categories = {}

        for entry in entries:
            amount = Decimal(entry["amount"])
            period = self._format_period(entry["created_at"], group_by)
            category = entry["category"]

            self._add_amount(totals, amount, entry["type"])
            self._add_amount(series.setdefault(period, self._empty_bucket()), amount, entry["type"])
            self._add_amount(categories.setdefault(category, self._empty_bucket()), amount, entry["type"])

        return {
            "group_by": group_by,
            "start_date": start_date,
            "end_date": end_date,
            "totals": self._serialize_bucket(totals),
            "series": [
                {"period": period, **self._serialize_bucket(bucket)}
                for period, bucket in series.items()
            ],
            "categories": [
                {"category": category, **self._serialize_bucket(bucket)}
                for category, bucket in sorted(
                    categories.items(),
                    key=lambda item: item[0] or "",
                )
            ],
        }

    def _format_period(self, created_at, group_by):
        local_date = timezone.localtime(created_at).date()

        if group_by == "day":
            return local_date.isoformat()

        return f"{local_date.year:04d}-{local_date.month:02d}"

    def _empty_bucket(self):
        return {
            "count": 0,
            "expenses": ZERO_MONEY,
            "refunds": ZERO_MONEY,
            "balance": ZERO_MONEY,
        }

    def _add_amount(self, bucket, amount, entry_type):
        bucket["count"] += 1

        if entry_type == FinancialEntry.FinancialType.EXPENSE:
            bucket["expenses"] += amount
            bucket["balance"] += amount
            return

        if entry_type == FinancialEntry.FinancialType.REFUND:
            bucket["refunds"] += amount
            bucket["balance"] -= amount
            return

        raise serializers.ValidationError({
            "type": "errors.financial_chart.unsupported_financial_type"
        })

    def _serialize_bucket(self, bucket):
        return {
            "count": bucket["count"],
            "expenses": self._money(bucket["expenses"]),
            "refunds": self._money(bucket["refunds"]),
            "balance": self._money(bucket["balance"]),
        }

    def _money(self, value):
        return str(value.quantize(MONEY_QUANTIZE))


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
            "task",
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
    filterset_fields = ["folder", "time_entry", "type", "category", "created_by"]
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
            "document",
            "time_entry",
            "task",
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
            "task",
            "created_by",
        )

    def post(self, request, project_id, pk):
        financial_entry = self.get_object()

        financial_entry.restore()

        serializer = self.get_serializer(financial_entry)
        return Response(serializer.data)
