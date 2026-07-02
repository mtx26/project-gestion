from decimal import Decimal

import django_filters
from django.db.models import Case, DecimalField, ExpressionWrapper, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce, Round
from django.shortcuts import get_object_or_404
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
from ..services.time_entries import compute_time_entry_stats


class TimeEntryFilter(django_filters.FilterSet):
    folder = django_filters.NumberFilter(method="filter_folder")
    target = django_filters.CharFilter(method="filter_target")

    class Meta:
        model = TimeEntry
        fields = ["user", "task"]

    def filter_folder(self, queryset, name, value):
        project_id = self.request.parser_context["kwargs"].get("project_id")
        if not project_id:
            return queryset
        folder_ids = get_descendant_folder_ids(value, project_id)
        return queryset.filter(folder_id__in=folder_ids)

    def filter_target(self, queryset, name, value):
        project_id = self.request.parser_context["kwargs"].get("project_id")
        if value == "project":
            return queryset.filter(folder__isnull=True, task__isnull=True)
        if value.startswith("task-"):
            try:
                task_id = int(value.replace("task-", ""))
            except (ValueError, TypeError):
                return queryset
            return queryset.filter(task_id=task_id)
        if value.startswith("folder-") and project_id:
            try:
                folder_id = int(value.replace("folder-", ""))
            except (ValueError, TypeError):
                return queryset
            folder_ids = get_descendant_folder_ids(folder_id, project_id)
            return queryset.filter(Q(folder_id__in=folder_ids) | Q(task__folder_id__in=folder_ids))
        return queryset


def _annotate_financial_fields(queryset):
    cost_amount = Round(
        ExpressionWrapper(
            F("duration_minutes") * F("hourly_rate") / Value(60),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
        precision=2,
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
    return queryset.annotate(filter_cost_amount=cost_amount, filter_paid_amount=paid_amount)


def apply_time_entry_financial_filters(queryset, request):
    """Applies date range and payment_status filters. Annotates when needed.

    Par defaut (payment_status="all"), les entrees deja entierement payees sont
    masquees ; `include_paid=true` les reintegre. Un `payment_status` explicite
    (paid/unpaid/partial/not_paid) prend le dessus sur ce masquage.
    """
    payment_status = request.query_params.get("payment_status", "all")
    include_paid = request.query_params.get("include_paid") == "true"
    start_date = parse_date(request.query_params.get("start_date", "") or "")
    end_date = parse_date(request.query_params.get("end_date", "") or "")

    has_status_filter = bool(payment_status) and payment_status not in ("all", "")
    needs_annotation = has_status_filter or not include_paid

    if needs_annotation:
        queryset = _annotate_financial_fields(queryset)

    if start_date or end_date:
        date_filter = Q()
        if start_date:
            date_filter &= Q(start_date__date__gte=start_date)
        if end_date:
            date_filter &= Q(start_date__date__lte=end_date)
        queryset = queryset.filter(date_filter)

    if has_status_filter:
        if payment_status == "paid":
            return queryset.filter(filter_paid_amount__gte=F("filter_cost_amount"))
        if payment_status == "unpaid":
            return queryset.filter(
                filter_paid_amount__lte=Value(Decimal("0")),
                filter_cost_amount__gt=Value(Decimal("0")),
            )
        if payment_status == "partial":
            return queryset.filter(
                filter_paid_amount__gt=Value(Decimal("0")),
                filter_paid_amount__lt=F("filter_cost_amount"),
            )
        if payment_status == "not_paid":
            return queryset.filter(filter_cost_amount__gt=F("filter_paid_amount"))
        return queryset

    if not include_paid:
        # Masque uniquement les entrees avec un cout reel deja entierement paye ;
        # les entrees a cout nul (ex: taux horaire 0) restent visibles.
        return queryset.filter(
            Q(filter_cost_amount__lte=Value(Decimal("0")))
            | Q(filter_paid_amount__lt=F("filter_cost_amount"))
        )

    return queryset


@extend_schema(tags=["time entries"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les entrées de temps d'un projet",
        description=(
            "Retourne les entrées de temps actives d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `task`, `user`, `target` (project/folder-{id}/task-{id}),\n"
            "  `payment_status` (all/paid/unpaid/partial/not_paid), `start_date`, `end_date`, `include_paid`.\n\n"
            "- Recherche disponible : `search` sur `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `time_entry.view`.\n\n"
            "- Restriction : sans `time_entry.view_all`, seules les entrées de l'utilisateur connecté sont retournées."
        ),
    ),
    post=extend_schema(
        summary="Créer une entrée de temps",
        description="Crée une nouvelle entrée de temps dans un projet.\nPermission requise : `time_entry.edit`.",
    ),
)
class TimeEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = TimeEntryFilter
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

        project_id = self.kwargs["project_id"]
        queryset = TimeEntry.objects.filter(
            project_id=project_id,
            project__in=get_accessible_projects(self.request.user),
        )
        project = get_object_or_404(get_accessible_projects(self.request.user), pk=project_id)
        if not has_project_permission(self.request.user, project, "time_entry.view_all"):
            queryset = queryset.filter(user=self.request.user)

        queryset = apply_time_entry_financial_filters(queryset, self.request)

        return (
            queryset
            .select_related("project", "folder", "task", "user")
            .prefetch_related("financial_entries", "documents")
            .order_by("-start_date", "-id")
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
        summary="Statistiques des entrées de temps",
        description=(
            "Retourne les totaux agrégés pour l'ensemble des entrées correspondant aux filtres.\n\n"
            "Accepte les mêmes filtres que le endpoint de liste (sauf `page`).\n\n"
            "Permission requise : `time_entry.view`."
        ),
    )
)
class TimeEntryStatsView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "time_entry.view"

    def get(self, request, project_id):
        if getattr(self, "swagger_fake_view", False):
            return Response({
                "duration_minutes": 0,
                "cost_amount": "0.00",
                "paid_amount": "0.00",
                "remaining_amount": "0.00",
                "entry_count": 0,
            })

        queryset = TimeEntry.objects.filter(
            project_id=project_id,
            project__in=get_accessible_projects(request.user),
        )
        project = get_object_or_404(get_accessible_projects(request.user), pk=project_id)
        if not has_project_permission(request.user, project, "time_entry.view_all"):
            queryset = queryset.filter(user=request.user)

        filterset = TimeEntryFilter(request.query_params, queryset=queryset, request=request)
        queryset = filterset.qs
        queryset = apply_time_entry_financial_filters(queryset, request)

        if "filter_cost_amount" not in queryset.query.annotations:
            queryset = _annotate_financial_fields(queryset)

        return Response(compute_time_entry_stats(queryset))


@extend_schema(tags=["time entries"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'une entrée de temps",
        description="Retourne une entrée de temps précise.\nPermission requise : `time_entry.view`.",
    ),
    put=extend_schema(
        summary="Modifier une entrée de temps",
        description="Modifie complètement une entrée de temps.\nPermission requise : `time_entry.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement une entrée de temps",
        description="Modifie partiellement une entrée de temps.\nPermission requise : `time_entry.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer une entrée de temps",
        description="Supprime une entrée de temps via soft delete.\nPermission requise : `time_entry.delete`.",
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
        summary="Marquer une entrée de temps comme payée",
        description=(
            "Crée une entrée financière liée à l'entrée de temps.\n"
            "Utiliser `pay_full=true` pour solder complètement, ou `amount` pour un paiement partiel.\n"
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
        summary="Lister les entrées de temps supprimées",
        description=(
            "Retourne les entrées de temps supprimées d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `task`, `user`, `target` (project/folder-{id}/task-{id}).\n\n"
            "- Recherche disponible : `search` sur `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `time_entry.restore`."
        ),
    )
)
class TimeEntryTrashListView(generics.ListAPIView):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = TimeEntryFilter
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
        )
        return (
            queryset
            .select_related("project", "folder", "task", "user")
            .prefetch_related("financial_entries", "documents")
            .order_by("-start_date", "-id")
        )


@extend_schema(tags=["time entries"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer une entrée de temps",
        description="Restaure une entrée de temps supprimée.\nPermission requise : `time_entry.restore`.",
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
