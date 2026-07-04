from django.shortcuts import get_object_or_404

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Invitation
from ..permissions import HasProjectPermission
from ..serializers import (
    InvitationAcceptSerializer,
    InvitationCreateSerializer,
    InvitationSerializer,
)
from ..services.invitations import get_project_invitations
from ..services.projects import get_accessible_projects
from core.views import PermissionCodeByMethodMixin, SoftDeleteDestroyMixin


@extend_schema(tags=["member"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les invitations d'un projet",
        description=(
            "Retourne les invitations d'un projet.\n\n"
            "- Filtres disponibles : `role`.\n\n"
            "- Recherche disponible : `search` sur l'email invité et le nom du rôle.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `member.view`."
        ),
    ),
    post=extend_schema(
        summary="Inviter un utilisateur",
        description=(
            "Crée une invitation pour un email.\n"
            "Si un compte existe déjà pour cet email, une notification interne est créée.\n"
            "Sinon, un email d'invitation est envoyé.\n"
            "Permission requise : `member.edit`."
        ),
        request=InvitationCreateSerializer,
        responses={status.HTTP_201_CREATED: InvitationSerializer},
    ),
)
class InvitationListCreateView(PermissionCodeByMethodMixin, generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {"GET": "member.view", "POST": "member.edit"}
    filterset_fields = ["role"]
    search_fields = ["email", "role__name"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return InvitationCreateSerializer

        return InvitationSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Invitation.objects.none()

        return get_project_invitations(
            self.request.user,
            self.kwargs["project_id"],
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()

        if getattr(self, "swagger_fake_view", False):
            return context

        if self.request.method == "POST":
            context["project"] = get_object_or_404(
                get_accessible_projects(self.request.user),
                pk=self.kwargs["project_id"],
            )
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = serializer.save()

        output_serializer = InvitationSerializer(
            invitation,
            context=serializer.context,
        )
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["member"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'une invitation",
        description="Retourne une invitation précise.\nPermission requise : `member.view`.",
    ),
    patch=extend_schema(
        summary="Modifier une invitation",
        description="Modifie le rôle d'une invitation en attente.\nPermission requise : `member.edit`.",
    ),
    delete=extend_schema(
        summary="Annuler une invitation",
        description="Annule une invitation via soft delete.\nPermission requise : `member.edit`.",
    ),
)
class InvitationDetailView(SoftDeleteDestroyMixin, PermissionCodeByMethodMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {
        "GET": "member.view",
        "PUT": "member.edit",
        "PATCH": "member.edit",
        "DELETE": "member.edit",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Invitation.objects.none()

        return get_project_invitations(
            self.request.user,
            self.kwargs["project_id"],
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project_id"] = self.kwargs["project_id"]
        return context


@extend_schema(tags=["member"])
@extend_schema_view(
    post=extend_schema(
        summary="Accepter une invitation",
        description=(
            "Accepte une invitation par token.\n"
            "L'utilisateur connecté doit avoir le même email que l'invitation."
        ),
        request=InvitationAcceptSerializer,
        responses={status.HTTP_200_OK: InvitationAcceptSerializer},
    ),
)
class InvitationAcceptView(generics.GenericAPIView):
    serializer_class = InvitationAcceptSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        output_serializer = self.get_serializer(result)
        return Response(output_serializer.data)
