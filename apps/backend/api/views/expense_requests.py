from django.shortcuts import get_object_or_404

import django_filters
from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..utils import FolderScopedFilterSet, StableOrderingFilter

from ..models import ExpenseRequest
from ..permissions import HasProjectPermission
from ..serializers import ExpenseRequestSerializer
from ..services.expense_requests import (
    approve_expense_request,
    get_project_deleted_expense_requests,
    get_project_expense_requests,
    reject_expense_request,
)
from ..services.projects import get_accessible_projects
from core.views import PermissionCodeByMethodMixin, RestoreModelMixin, SoftDeleteDestroyMixin


class ExpenseRequestFilter(FolderScopedFilterSet):
    exclude_rejected = django_filters.BooleanFilter(method="filter_exclude_rejected")
    date_from = django_filters.DateFilter(field_name="created_at__date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="created_at__date", lookup_expr="lte")

    class Meta:
        model = ExpenseRequest
        fields = ["status", "requested_by"]

    def filter_exclude_rejected(self, queryset, _name, value):
        if value:
            return queryset.exclude(status="rejected")
        return queryset


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les demandes de remboursement",
        description=(
            "Retourne toutes les demandes de remboursement actives d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `status`, `requested_by`, `exclude_rejected`.\n\n"
            "- Recherche disponible : `search` sur `title`, `category` et `description`.\n\n"
            "- Tri disponible : `ordering` sur `title`, `amount`, `created_at`. Préfixer avec `-` pour ordre descendant.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `expense_request.view`."
        ),
    ),
    post=extend_schema(
        summary="Créer une demande de remboursement",
        description="Crée une nouvelle demande de remboursement.\nPermission requise : `expense_request.edit`.",
    ),
)
class ExpenseRequestListCreateView(PermissionCodeByMethodMixin, generics.ListCreateAPIView):
    serializer_class = ExpenseRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {"GET": "expense_request.view", "POST": "expense_request.edit"}
    filter_backends = [DjangoFilterBackend, SearchFilter, StableOrderingFilter]
    filterset_class = ExpenseRequestFilter
    search_fields = ["title", "category", "description"]
    ordering_fields = ["title", "amount", "created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExpenseRequest.objects.none()

        return get_project_expense_requests(self.request.user, self.kwargs["project_id"]).order_by("-created_at", "-id")

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        serializer.save(project=project, requested_by=self.request.user)


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'une demande de remboursement",
        description="Retourne une demande de remboursement précise.\nPermission requise : `expense_request.view`.",
    ),
    put=extend_schema(
        summary="Modifier une demande de remboursement",
        description="Modifie complètement une demande de remboursement.\nPermission requise : `expense_request.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement une demande de remboursement",
        description="Modifie partiellement une demande de remboursement.\nPermission requise : `expense_request.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer une demande de remboursement",
        description="Supprime une demande de remboursement via soft delete.\nPermission requise : `expense_request.delete`.",
    ),
)
class ExpenseRequestDetailView(SoftDeleteDestroyMixin, PermissionCodeByMethodMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExpenseRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {
        "GET": "expense_request.view",
        "PUT": "expense_request.edit",
        "PATCH": "expense_request.edit",
        "DELETE": "expense_request.delete",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExpenseRequest.objects.none()

        return get_project_expense_requests(self.request.user, self.kwargs["project_id"])


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    post=extend_schema(
        summary="Approuver une demande de remboursement",
        description=(
            "Approuve une demande en attente et crée automatiquement une entrée financière "
            "de type dépense avec le même dossier et montant.\n"
            "Permission requise : `expense_request.approve`."
        ),
        request=None,
    )
)
class ExpenseRequestApproveView(generics.GenericAPIView):
    serializer_class = ExpenseRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "expense_request.approve"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExpenseRequest.objects.none()

        return get_project_expense_requests(
            self.request.user, self.kwargs["project_id"],
        ).filter(status=ExpenseRequest.Status.PENDING)

    def post(self, request, project_id, pk):
        expense_request = self.get_object()
        approve_expense_request(expense_request, approved_by=request.user)

        serializer = self.get_serializer(expense_request)
        return Response(serializer.data)


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    post=extend_schema(
        summary="Refuser une demande de remboursement",
        description="Refuse une demande en attente.\nPermission requise : `expense_request.approve`.",
        request=None,
    )
)
class ExpenseRequestRejectView(generics.GenericAPIView):
    serializer_class = ExpenseRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "expense_request.approve"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExpenseRequest.objects.none()

        return get_project_expense_requests(
            self.request.user, self.kwargs["project_id"],
        ).filter(status=ExpenseRequest.Status.PENDING)

    def post(self, request, project_id, pk):
        expense_request = self.get_object()
        reject_expense_request(expense_request)

        serializer = self.get_serializer(expense_request)
        return Response(serializer.data)


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les demandes de remboursement supprimées",
        description=(
            "Retourne les demandes de remboursement supprimées d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `status`, `requested_by`, `exclude_rejected`.\n\n"
            "- Recherche disponible : `search` sur `title`, `category` et `description`.\n\n"
            "- Tri disponible : `ordering` sur `title`, `amount`, `created_at`. Préfixer avec `-` pour ordre descendant.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `expense_request.restore`."
        ),
    )
)
class ExpenseRequestTrashListView(generics.ListAPIView):
    serializer_class = ExpenseRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "expense_request.restore"
    filter_backends = [DjangoFilterBackend, SearchFilter, StableOrderingFilter]
    filterset_class = ExpenseRequestFilter
    search_fields = ["title", "category", "description"]
    ordering_fields = ["title", "amount", "created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExpenseRequest.deleted_objects.none()

        queryset = get_project_deleted_expense_requests(self.request.user, self.kwargs["project_id"])
        return queryset.order_by("-created_at", "-id")


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer une demande de remboursement",
        description="Restaure une demande de remboursement supprimée.\nPermission requise : `expense_request.restore`.",
        request=None,
    )
)
class ExpenseRequestRestoreView(RestoreModelMixin, generics.GenericAPIView):
    serializer_class = ExpenseRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "expense_request.restore"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExpenseRequest.deleted_objects.none()

        return get_project_deleted_expense_requests(self.request.user, self.kwargs["project_id"])
