from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema, extend_schema_view

from ..permissions import CanManageRoles
from ..models import Permission
from ..serializers import RoleSerializer, PermissionSerializer
from ..services.roles import get_deleted_project_roles, get_project_roles


@extend_schema_view(
    get=extend_schema(
        summary="Lister les roles d'un projet",
        description="Retourne tous les roles accessibles pour un projet donne.",
    ),
    post=extend_schema(
        summary="Creer un role",
        description="Cree un nouveau role dans le projet indique.",
    ),
)
class RoleListCreateView(generics.ListCreateAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, CanManageRoles]

    def get_queryset(self):
        return get_project_roles(
            self.request.user,
            self.kwargs["project_id"],
        )

    def perform_create(self, serializer):
        serializer.save(
            project_id=self.kwargs["project_id"],
        )


@extend_schema_view(
    get=extend_schema(
        summary="Recuperer un role",
        description="Retourne les details d'un role precis d'un projet.",
    ),
    put=extend_schema(
        summary="Remplacer un role",
        description="Remplace entierement les donnees d'un role.",
    ),
    patch=extend_schema(
        summary="Modifier un role",
        description="Modifie partiellement les donnees d'un role.",
    ),
    delete=extend_schema(
        summary="Supprimer un role",
        description="Supprime un role du projet.",
    ),
)
class RoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, CanManageRoles]

    def get_queryset(self):
        return get_project_roles(
            self.request.user,
            self.kwargs["project_id"],
        )

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)


@extend_schema_view(
    post=extend_schema(
        summary="Restaurer un role",
        description="Restaure un role supprime d'un projet.",
    ),
)
class RoleRestoreView(generics.GenericAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, CanManageRoles]

    def get_queryset(self):
        return get_deleted_project_roles(
            self.request.user,
            self.kwargs["project_id"],
        )

    def post(self, request, project_id, pk):
        role = self.get_object()

        role.restore()

        serializer = self.get_serializer(role)
        return Response(serializer.data)


@extend_schema_view(
    get=extend_schema(
        summary="Lister les roles supprimes",
        description="Retourne tous les roles supprimes pour un projet donne.",
    ),
)
class RoleTrashListView(generics.ListAPIView):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, CanManageRoles]

    def get_queryset(self):
        return get_deleted_project_roles(
            self.request.user,
            self.kwargs["project_id"],
        )


@extend_schema_view(
    get=extend_schema(
        summary="Lister les permissions",
        description="Retourne toutes les permissions disponibles pour creer ou modifier un role.",
    ),
)
class PermissionListView(generics.ListAPIView):
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Permission.objects.all()
