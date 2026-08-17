from decimal import Decimal
from functools import cached_property

import django_filters
from django.db.models import F, Q
from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import TimeEntry
from ..authorization import HasProjectPermission, PermissionCodeByMethodMixin
from ..serializers import (
    TimeEntryBulkPaymentSerializer,
    TimeEntryPaymentCorrectionSerializer,
    TimeEntryPaymentSerializer,
    TimeEntrySerializer,
)
from ..services.folders import get_descendant_folder_ids
from ..services.projects import get_accessible_projects
from ..services.time_entries import (
    compute_time_entry_stats,
    get_project_deleted_time_entries,
    get_project_deleted_time_entries_base,
    get_project_time_entries,
    get_project_time_entries_base,
)
from ..utils import FolderScopedFilterSet
from core.views import RestoreModelMixin, SoftDeleteDestroyMixin

PAYMENT_STATUS_CHOICES = [
    ("all", "all"),
    ("paid", "paid"),
    ("unpaid", "unpaid"),
    ("partial", "partial"),
    ("not_paid", "not_paid"),
]


class TimeEntryFilter(FolderScopedFilterSet):
    # Ordre des champs imposé par le Filtering Style Guide §5 : (a) folder — hérité
    # de FolderScopedFilterSet —, (b) booléens, (c) dates, (d) enum/mini-langage.
    include_paid = django_filters.BooleanFilter(method="noop")
    start_date = django_filters.DateFilter(field_name="start_date__date", lookup_expr="gte")
    end_date = django_filters.DateFilter(field_name="start_date__date", lookup_expr="lte")
    user = django_filters.CharFilter(method="filter_user")
    target = django_filters.CharFilter(method="filter_target")
    payment_status = django_filters.ChoiceFilter(choices=PAYMENT_STATUS_CHOICES, method="filter_payment_status")

    class Meta:
        model = TimeEntry
        fields = ["task"]

    def noop(self, queryset, name, value):
        return queryset

    def filter_user(self, queryset, name, value):
        """`user=<id>` ou `user=none` pour les entrees orphelines — celles dont le titulaire
        a ete supprime (`TimeEntry.user` est en `SET_NULL`). Sans ce mini-langage, ces heures
        ne sont atteignables par aucun filtre alors qu'elles pesent dans les totaux."""
        if value in (None, "", "all"):
            return queryset
        if value == "none":
            return queryset.filter(user__isnull=True)
        try:
            return queryset.filter(user_id=int(value))
        except (TypeError, ValueError):
            return queryset

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

    def filter_payment_status(self, queryset, name, value):
        if value in (None, "", "all"):
            return queryset
        if value == "paid":
            return queryset.filter(filter_paid_amount__gte=F("filter_cost_amount"))
        if value == "unpaid":
            return queryset.filter(
                filter_paid_amount__lte=Decimal("0"),
                filter_cost_amount__gt=Decimal("0"),
            )
        if value == "partial":
            return queryset.filter(
                filter_paid_amount__gt=Decimal("0"),
                filter_paid_amount__lt=F("filter_cost_amount"),
            )
        if value == "not_paid":
            return queryset.filter(filter_cost_amount__gt=F("filter_paid_amount"))
        return queryset


class TimeEntryListFilter(TimeEntryFilter):
    """Same filters as `TimeEntryFilter`, but hides fully-paid entries by default.

    Only the active list/stats endpoints have this default masking (a UX choice to
    keep already-settled entries out of the way); the trash endpoint shows every
    deleted entry regardless of payment status, as it always has.
    """

    @property
    def qs(self):
        queryset = super().qs

        # Par defaut (payment_status absent/"all"), les entrees deja entierement
        # payees sont masquees ; `include_paid=true` les reintegre. Un payment_status
        # explicite (paid/unpaid/partial/not_paid) prend le dessus sur ce masquage.
        payment_status = self.form.cleaned_data.get("payment_status")
        if payment_status in (None, "", "all"):
            include_paid = self.form.cleaned_data.get("include_paid") or False
            if not include_paid:
                queryset = queryset.filter(filter_paid_amount__lt=F("filter_cost_amount"))
        return queryset


@extend_schema(tags=["time entries"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les entrées de temps d'un projet",
        description=(
            "Retourne les entrées de temps actives d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `task`, `user` ({id} ou `none` pour les entrées\n"
            "  orphelines), `target` (project/folder-{id}/task-{id}), `payment_status` (all/paid/unpaid/partial/not_paid),\n"
            "  `start_date`, `end_date`, `include_paid`.\n\n"
            "- Recherche disponible : `search` sur `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `time_entry.view`.\n\n"
            "- Restriction : sans `time_entry.view_others_detail`, seules les entrées de l'utilisateur connecté sont retournées."
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
    filterset_class = TimeEntryListFilter
    search_fields = ["description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimeEntry.objects.none()

        queryset = get_project_time_entries(self.request.user, self.kwargs["project_id"], "time_entry.view_others_detail")
        return queryset.order_by("-start_date", "-id")

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
            "Retourne les totaux agrégés pour l'ensemble des entrées correspondant aux filtres,\n"
            "ainsi que la répartition par membre (`by_user`) — visible dès `time_entry.view_all`,\n"
            "indépendamment de `time_entry.view_others_detail`.\n\n"
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
                "by_user": [],
            })

        queryset = get_project_time_entries(request.user, project_id, "time_entry.view_all")
        filterset = TimeEntryListFilter(request.query_params, queryset=queryset, request=request)

        return Response(compute_time_entry_stats(filterset.qs))


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

        queryset = get_project_time_entries_base(self.request.user, self.kwargs["project_id"])

        if self.request.method == "GET":
            project = get_object_or_404(
                get_accessible_projects(self.request.user),
                pk=self.kwargs["project_id"],
            )
            queryset = queryset.own_unless_has_permission(self.request.user, project, "time_entry.view_others_detail")

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
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "time_entry.pay"

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return TimeEntryPaymentCorrectionSerializer
        return TimeEntryPaymentSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimeEntry.objects.none()

        return get_project_time_entries_base(self.request.user, self.kwargs["project_id"])

    @cached_property
    def time_entry(self):
        return self.get_object()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if not getattr(self, "swagger_fake_view", False):
            context["time_entry"] = self.time_entry
        return context

    def post(self, request, project_id, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        return Response(self.get_serializer(payment).data, status=status.HTTP_201_CREATED)

    def patch(self, request, project_id, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        correction = serializer.save()
        return Response(self.get_serializer(correction).data)


@extend_schema(tags=["time entries"])
@extend_schema_view(
    post=extend_schema(
        summary="Payer un montant global réparti sur plusieurs entrées de temps",
        description=(
            "Répartit le montant envoyé sur les entrées de temps correspondant aux filtres,\n"
            "de la plus ancienne à la plus récente : chaque entrée est soldée entièrement tant\n"
            "que le montant restant le permet, seule la dernière servie pouvant l'être partiellement.\n\n"
            "Accepte les mêmes filtres (en query string) que le endpoint de stats, pour que le montant\n"
            "payable corresponde exactement au `remaining_amount` affiché. Le filtre `user` est\n"
            "obligatoire : un paiement cible un membre précis.\n\n"
            "Permission requise : `time_entry.pay`."
        ),
        request=TimeEntryBulkPaymentSerializer,
        responses=TimeEntryBulkPaymentSerializer,
    )
)
class TimeEntryBulkPaymentView(generics.GenericAPIView):
    serializer_class = TimeEntryBulkPaymentSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "time_entry.pay"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimeEntry.objects.none()

        # Meme scope que `TimeEntryStatsView` (`time_entry.view_all`, dont `time_entry.pay`
        # depend deja) : un payeur paie exactement le total qu'il voit dans la synthese,
        # sans avoir besoin de `time_entry.view_others_detail`.
        queryset = get_project_time_entries(self.request.user, self.kwargs["project_id"], "time_entry.view_all")
        return TimeEntryListFilter(self.request.query_params, queryset=queryset, request=self.request).qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if not getattr(self, "swagger_fake_view", False):
            context["queryset"] = self.get_queryset()
            context["scope_user"] = self.request.query_params.get("user")
        return context

    def post(self, request, project_id):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(self.get_serializer(result).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["time entries"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les entrées de temps supprimées",
        description=(
            "Retourne les entrées de temps supprimées d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `task`, `user`, `target` (project/folder-{id}/task-{id}),\n"
            "  `payment_status` (all/paid/unpaid/partial/not_paid), `start_date`, `end_date`, `include_paid`.\n\n"
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
    filterset_class = TimeEntryFilter
    search_fields = ["description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimeEntry.deleted_objects.none()

        queryset = get_project_deleted_time_entries(self.request.user, self.kwargs["project_id"])
        return queryset.order_by("-start_date", "-id")


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

        return get_project_deleted_time_entries_base(self.request.user, self.kwargs["project_id"])
