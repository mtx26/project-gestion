from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import ExpenseRequest, FinancialEntry
from ..permissions import HasProjectPermission
from ..serializers import ExpenseRequestSerializer
from ..services.projects import get_accessible_projects


def _expense_request_qs(user, project_id, **extra_filters):
    return ExpenseRequest.objects.filter(
        project_id=project_id,
        project__in=get_accessible_projects(user),
        **extra_filters,
    ).select_related(
        "project",
        "folder",
        "task",
        "requested_by",
        "approved_by",
    ).prefetch_related("documents")


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les demandes de remboursement",
        description="Retourne toutes les demandes de remboursement actives d'un projet.\nPermission requise : `expense_request.view`.",
    ),
    post=extend_schema(
        summary="Creer une demande de remboursement",
        description="Cree une nouvelle demande de remboursement.\nPermission requise : `expense_request.edit`.",
    ),
)
class ExpenseRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["status", "folder", "requested_by"]
    search_fields = ["title", "category", "description"]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "expense_request.view"
        elif self.request.method == "POST":
            self.permission_code = "expense_request.edit"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExpenseRequest.objects.none()

        return _expense_request_qs(self.request.user, self.kwargs["project_id"]).order_by("-created_at", "-id")

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        serializer.save(project=project, requested_by=self.request.user)


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    get=extend_schema(
        summary="Detail d'une demande de remboursement",
        description="Retourne une demande de remboursement precise.\nPermission requise : `expense_request.view`.",
    ),
    put=extend_schema(
        summary="Modifier une demande de remboursement",
        description="Modifie une demande de remboursement (seulement si en attente).\nPermission requise : `expense_request.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement une demande de remboursement",
        description="Modifie partiellement une demande de remboursement.\nPermission requise : `expense_request.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer une demande de remboursement",
        description="Supprime une demande via soft delete.\nPermission requise : `expense_request.delete`.",
    ),
)
class ExpenseRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExpenseRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "expense_request.view"
        elif self.request.method in ["PUT", "PATCH"]:
            self.permission_code = "expense_request.edit"
        elif self.request.method == "DELETE":
            self.permission_code = "expense_request.delete"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExpenseRequest.objects.none()

        return _expense_request_qs(self.request.user, self.kwargs["project_id"])

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    post=extend_schema(
        summary="Approuver une demande de remboursement",
        description=(
            "Approuve une demande en attente et cree automatiquement une entree financiere "
            "de type depense avec le meme dossier et montant.\n\n"
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

        return _expense_request_qs(
            self.request.user, self.kwargs["project_id"], status=ExpenseRequest.STATUS_PENDING
        )

    def post(self, request, project_id, pk):
        expense_request = self.get_object()

        with transaction.atomic():
            expense_request.status = ExpenseRequest.STATUS_APPROVED
            expense_request.approved_by = request.user
            expense_request.approved_at = timezone.now()
            expense_request.save()

            financial_entry = FinancialEntry.objects.create(
                project=expense_request.project,
                folder=expense_request.folder,
                task=expense_request.task,
                created_by=request.user,
                amount=expense_request.amount,
                type=FinancialEntry.FinancialType.EXPENSE,
                category=expense_request.category,
                description=expense_request.title,
            )
            if expense_request.documents.exists():
                financial_entry.documents.set(expense_request.documents.all())

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

        return _expense_request_qs(
            self.request.user, self.kwargs["project_id"], status=ExpenseRequest.STATUS_PENDING
        )

    def post(self, request, project_id, pk):
        expense_request = self.get_object()
        expense_request.status = ExpenseRequest.STATUS_REJECTED
        expense_request.save()
        serializer = self.get_serializer(expense_request)
        return Response(serializer.data)


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les demandes de remboursement supprimees",
        description="Retourne les demandes de remboursement en corbeille.\nPermission requise : `expense_request.restore`.",
    )
)
class ExpenseRequestTrashListView(generics.ListAPIView):
    serializer_class = ExpenseRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        self.permission_code = "expense_request.restore"
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExpenseRequest.deleted_objects.none()

        return ExpenseRequest.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "task",
            "requested_by",
            "approved_by",
        ).prefetch_related("documents").order_by("-created_at", "-id")


@extend_schema(tags=["expense-requests"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer une demande de remboursement",
        description="Restaure une demande de remboursement supprimee.\nPermission requise : `expense_request.restore`.",
        request=None,
    )
)
class ExpenseRequestRestoreView(generics.GenericAPIView):
    serializer_class = ExpenseRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "expense_request.restore"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExpenseRequest.deleted_objects.none()

        return ExpenseRequest.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).select_related(
            "project",
            "folder",
            "task",
            "requested_by",
            "approved_by",
        ).prefetch_related("documents")

    def post(self, request, project_id, pk):
        expense_request = self.get_object()
        expense_request.restore()
        serializer = self.get_serializer(expense_request)
        return Response(serializer.data)
