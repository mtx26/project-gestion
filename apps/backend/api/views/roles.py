from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import Permission, Role
from ..permissions import HasProjectPermission
from ..serializers import RoleSerializer, PermissionSerializer
from ..services.projects import get_accessible_projects
from ..services.roles import (
    get_project_deleted_roles,
    get_project_roles,
)
from core.views import PermissionCodeByMethodMixin, RestoreModelMixin, SoftDeleteDestroyMixin


@extend_schema(tags=["roles"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les rôles d'un projet",
        description=(
            "Retourne tous les rôles d'un projet.\n\n"
            "- Recherche disponible : `search` sur `name` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `role.view`."
        ),
    ),
    post=extend_schema(
        summary="Créer un rôle",
        description="Crée un nouveau rôle dans le projet.\nPermission requise : `role.edit`.",
    ),
)
class RoleListCreateView(PermissionCodeByMethodMixin, generics.ListCreateAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {"GET": "role.view", "POST": "role.edit"}
    search_fields = ["name", "description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Role.objects.none()

        return get_project_roles(
            self.request.user,
            self.kwargs["project_id"],
        )

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )

        serializer.save(project=project)

@extend_schema(tags=["roles"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'un rôle",
        description="Retourne un rôle précis d'un projet.\nPermission requise : `role.view`.",
    ),
    put=extend_schema(
        summary="Modifier un rôle",
        description="Modifie complètement un rôle.\nPermission requise : `role.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement un rôle",
        description="Modifie partiellement un rôle.\nPermission requise : `role.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer un rôle",
        description="Supprime un rôle du projet via soft delete.\nPermission requise : `role.delete`.",
    ),
)
class RoleDetailView(SoftDeleteDestroyMixin, PermissionCodeByMethodMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {
        "GET": "role.view",
        "PUT": "role.edit",
        "PATCH": "role.edit",
        "DELETE": "role.delete",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Role.objects.none()

        return get_project_roles(
            self.request.user,
            self.kwargs["project_id"],
        )


@extend_schema(tags=["roles"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les rôles supprimés",
        description=(
            "Retourne les rôles supprimés d'un projet.\n\n"
            "- Recherche disponible : `search` sur `name` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `role.view`."
        ),
    )
)
class RoleTrashListView(generics.ListAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "role.view"
    search_fields = ["name", "description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Role.deleted_objects.none()

        return get_project_deleted_roles(
            self.request.user,
            self.kwargs["project_id"],
        )


@extend_schema(tags=["roles"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer un rôle",
        request=None,
        description="Restaure un rôle supprimé.\nPermission requise : `role.restore`.",
    )
)
class RoleRestoreView(RestoreModelMixin, generics.GenericAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "role.restore"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Role.deleted_objects.none()

        return get_project_deleted_roles(
            self.request.user,
            self.kwargs["project_id"],
        )


@extend_schema(tags=["permissions"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les permissions",
        description=(
            "Retourne toutes les permissions disponibles pour créer ou modifier un rôle.\n\n"
            "- Filtres disponibles : `code`.\n\n"
            "- Recherche disponible : `search` sur `code`, `name` et `description`.\n\n"
            "- Pagination disponible : `page`."
        ),
    ),
)
class PermissionListView(generics.ListAPIView):
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["code"]
    search_fields = ["code", "name", "description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Permission.objects.none()

        return Permission.objects.order_by("id")
