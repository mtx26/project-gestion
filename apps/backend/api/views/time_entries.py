from django.shortcuts import get_object_or_404
from django.db.models import Case, DecimalField, ExpressionWrapper, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils.dateparse import parse_date

from rest_framework import generics, status
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import FinancialEntry, TimeEntry
from ..permissions import HasProjectPermission
from ..serializers import TimeEntryPaymentSerializer, TimeEntrySerializer
from ..services.folders import get_descendant_folder_ids
from ..services.permissions import has_project_permission
from ..services.projects import get_accessible_projects


@extend_schema(tags=["time entries"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les entrees de temps d'un projet",
        description=(
            "Retourne toutes les entrees de temps actives d'un projet.\n\n"
            "- Filtres disponibles : `folder`, `task`, `user`, `start_date`, `end_date`, `include_unpaid`.\n\n"
            "- Recherche disponible : `search` sur `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `time_entry.view`.\n\n"
            "- Avec `time_entry.view_all`, toutes les entrees du projet sont visibles.\n\n"
            "- Sans `time_entry.view_all`, seules les entrees de l'utilisateur connecte sont visibles."
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
    filterset_fields = ["task", "user"]
    search_fields = ["description"]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "time_entry.view"
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
            "documents",
        ).order_by("-created_at", "-id")

        if not has_project_permission(self.request.user, project, "time_entry.view_all"):
            queryset = queryset.filter(user=self.request.user)

        folder_id_str = self.request.query_params.get("folder")
        if folder_id_str:
            try:
                folder_id = int(folder_id_str)
            except (ValueError, TypeError):
                pass
            else:
                folder_ids = get_descendant_folder_ids(folder_id, self.kwargs["project_id"])
                queryset = queryset.filter(folder_id__in=folder_ids)

        queryset = self.filter_by_date_range_and_unpaid(queryset)

        return queryset

    def filter_by_date_range_and_unpaid(self, queryset):
        start_date = parse_date(self.request.query_params.get("start_date", ""))
        end_date = parse_date(self.request.query_params.get("end_date", ""))
        include_unpaid = self.request.query_params.get("include_unpaid") == "true"

        date_filter = Q()
        if start_date:
            date_filter &= Q(created_at__date__gte=start_date)
        if end_date:
            date_filter &= Q(created_at__date__lte=end_date)

        if not start_date and not end_date:
            return queryset

        if not include_unpaid:
            return queryset.filter(date_filter)

        cost_amount = ExpressionWrapper(
            F("duration_minutes") * F("hourly_rate") / Value(60),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )
        paid_amount = Coalesce(
            Sum(
                Case(
                    When(
                        financial_entries__type=FinancialEntry.FinancialType.EXPENSE,
                        then=F("financial_entries__amount"),
                    ),
                    When(
                        financial_entries__type=FinancialEntry.FinancialType.REFUND,
                        then=-F("financial_entries__amount"),
                    ),
                    default=Value(0),
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                )
            ),
            Value(0),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )

        return queryset.annotate(
            filter_cost_amount=cost_amount,
            filter_paid_amount=paid_amount,
        ).filter(
            date_filter | Q(filter_paid_amount__lt=F("filter_cost_amount"))
        )

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

        queryset = TimeEntry.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "task",
            "user",
        ).prefetch_related(
            "financial_entries",
            "documents",
        )

        if self.request.method == "GET":
            project = get_object_or_404(
                get_accessible_projects(self.request.user),
                pk=self.kwargs["project_id"],
            )
            if not has_project_permission(self.request.user, project, "time_entry.view_all"):
                queryset = queryset.filter(user=self.request.user)

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

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)


@extend_schema(tags=["time entries"])
@extend_schema_view(
    post=extend_schema(
        summary="Marquer une entree de temps payee",
        description=(
            "Cree une entree finance liee a l'entree de temps.\n"
            "Utilise `pay_full=true` pour payer le reste complet, ou `amount` pour un paiement partiel.\n"
            "Permission requise : `time_entry.pay`."
        ),
        request=TimeEntryPaymentSerializer,
        responses=TimeEntryPaymentSerializer,
    )
)
class TimeEntryPaymentView(generics.GenericAPIView):
    serializer_class = TimeEntryPaymentSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "time_entry.pay"

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
            "documents",
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()

        if not getattr(self, "swagger_fake_view", False):
            context["time_entry"] = self.get_object()

        return context

    def post(self, request, project_id, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        return Response(self.get_serializer(payment).data, status=status.HTTP_201_CREATED)


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
    filterset_fields = ["task", "user"]
    search_fields = ["description"]

    def get_permissions(self):
        self.permission_code = "time_entry.restore"
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimeEntry.deleted_objects.none()

        queryset = TimeEntry.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "task",
            "user",
        ).prefetch_related(
            "financial_entries",
            "documents",
        ).order_by("-created_at", "-id")

        folder_id_str = self.request.query_params.get("folder")
        if folder_id_str:
            try:
                folder_id = int(folder_id_str)
            except (ValueError, TypeError):
                pass
            else:
                folder_ids = get_descendant_folder_ids(folder_id, self.kwargs["project_id"])
                queryset = queryset.filter(folder_id__in=folder_ids)

        return queryset


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
            "documents",
        )

    def post(self, request, project_id, pk):
        time_entry = self.get_object()

        time_entry.restore()

        serializer = self.get_serializer(time_entry)
        return Response(serializer.data)
