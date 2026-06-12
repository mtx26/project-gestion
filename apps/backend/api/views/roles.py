from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import Permission, Role
from ..permissions import HasProjectPermission
from ..serializers import RoleSerializer, PermissionSerializer
from ..services.permissions import get_permissions
from ..services.projects import get_accessible_projects
from ..services.roles import (
    get_deleted_project_roles,
    get_project_roles,
)


@extend_schema(tags=["roles"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les roles d'un projet",
        description=(
            "Retourne tous les roles accessibles pour un projet donne.\n\n"
            "- Recherche disponible : `search` sur `name` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `role.view`."
        ),
    ),
    post=extend_schema(
        summary="Creer un role",
        description="Cree un nouveau role dans le projet indique.\nPermission requise : `role.edit`.",
    ),
)
class RoleListCreateView(generics.ListCreateAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [SearchFilter]
    search_fields = ["name", "description"]

    def get_permissions(self):
        if self.request.method == "POST":
            self.permission_code = "role.edit"
        else:
            self.permission_code = "role.view"

        return super().get_permissions()

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
        summary="Recuperer un role",
        description="Retourne les details d'un role precis d'un projet.\nPermission requise : `role.view`.",
    ),
    put=extend_schema(
        summary="Remplacer un role",
        description="Remplace entierement les donnees d'un role.\nPermission requise : `role.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier un role",
        description="Modifie partiellement les donnees d'un role.\nPermission requise : `role.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer un role",
        description="Supprime un role du projet.\nPermission requise : `role.delete`.",
    ),
)
class RoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "role.view"
        elif self.request.method == "DELETE":
            self.permission_code = "role.delete"
        else:
            self.permission_code = "role.edit"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Role.objects.none()

        return get_project_roles(
            self.request.user,
            self.kwargs["project_id"],
        )

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)


@extend_schema(tags=["roles"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer un role",
        description="Restaure un role supprime d'un projet.\nPermission requise : `role.restore`.",
    ),
)
class RoleRestoreView(generics.GenericAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "role.restore"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Role.deleted_objects.none()

        return get_deleted_project_roles(
            self.request.user,
            self.kwargs["project_id"],
        )

    def post(self, request, project_id, pk):
        role = self.get_object()

        role.restore()

        serializer = self.get_serializer(role)
        return Response(serializer.data)


@extend_schema(tags=["roles"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les roles supprimes",
        description=(
            "Retourne tous les roles supprimes pour un projet donne.\n\n"
            "- Recherche disponible : `search` sur `name` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `role.view`."
        ),
    ),
)
class RoleTrashListView(generics.ListAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "role.view"
    filter_backends = [SearchFilter]
    search_fields = ["name", "description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Role.deleted_objects.none()

        return get_deleted_project_roles(
            self.request.user,
            self.kwargs["project_id"],
        )


@extend_schema(tags=["permissions"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les permissions",
        description=(
            "Retourne toutes les permissions disponibles pour creer ou modifier un role.\n\n"
            "- Filtres disponibles : `code`.\n\n"
            "- Recherche disponible : `search` sur `code`, `name` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `role.view`."
        ),
    ),
)
class PermissionListView(generics.ListAPIView):
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["code"]
    search_fields = ["code", "name", "description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Permission.objects.none()

        return get_permissions()
