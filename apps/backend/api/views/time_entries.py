import django_filters
from django.db.models import Q
from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import TimeEntry
from ..permissions import HasProjectPermission
from ..serializers import TimeEntryPaymentCorrectionSerializer, TimeEntryPaymentSerializer, TimeEntrySerializer
from ..services.folders import get_descendant_folder_ids
from ..services.permissions import has_project_permission
from ..services.projects import get_accessible_projects
from ..services.time_entries import annotate_financial_fields, apply_time_entry_financial_filters, compute_time_entry_stats
from ..utils import FolderScopedFilterMixin
from core.views import PermissionCodeByMethodMixin, RestoreModelMixin, SoftDeleteDestroyMixin


class TimeEntryFilter(FolderScopedFilterMixin, django_filters.FilterSet):
    folder = django_filters.NumberFilter(method="filter_folder")
    target = django_filters.CharFilter(method="filter_target")

    class Meta:
        model = TimeEntry
        fields = ["user", "task"]

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
class TimeEntryListCreateView(PermissionCodeByMethodMixin, generics.ListCreateAPIView):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {"GET": "time_entry.view", "POST": "time_entry.edit"}
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = TimeEntryFilter
    search_fields = ["description"]

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
            queryset = annotate_financial_fields(queryset)

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
class TimeEntryDetailView(SoftDeleteDestroyMixin, PermissionCodeByMethodMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {
        "GET": "time_entry.view",
        "PUT": "time_entry.edit",
        "PATCH": "time_entry.edit",
        "DELETE": "time_entry.delete",
    }

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
    ),
    patch=extend_schema(
        summary="Corriger le montant payé d'une entrée de temps",
        description=(
            "Ajuste le montant total payé sans modifier les paiements existants : crée une "
            "nouvelle entrée financière de dépense (si le nouveau montant est supérieur au "
            "montant payé actuel) ou de remboursement (s'il est inférieur).\n"
            "Permission requise : `time_entry.pay`."
        ),
        request=TimeEntryPaymentCorrectionSerializer,
        responses=TimeEntryPaymentCorrectionSerializer,
    ),
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

    def patch(self, request, project_id, pk):
        serializer = TimeEntryPaymentCorrectionSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        correction = serializer.save()
        return Response(TimeEntryPaymentCorrectionSerializer(correction, context=self.get_serializer_context()).data)


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
    permission_code = "time_entry.restore"
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = TimeEntryFilter
    search_fields = ["description"]

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
class TimeEntryRestoreView(RestoreModelMixin, generics.GenericAPIView):
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
