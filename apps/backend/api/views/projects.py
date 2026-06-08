from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema, extend_schema_view

from ..serializers import ProjectSerializer
from ..permissions import (
    CanEditProject,
    CanDeleteProject,
    CanRestoreProject,
)
from ..services.projects import (
    get_accessible_projects,
    get_accessible_deleted_projects,
)


@extend_schema_view(
    get=extend_schema(
        summary="Lister les projets",
        description="Retourne tous les projets accessibles pour l'utilisateur connecte.",
    ),
    post=extend_schema(
        summary="Creer un projet",
        description="Cree un nouveau projet pour l'utilisateur connecte.",
    ),
)
class ProjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return get_accessible_projects(self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


@extend_schema_view(
    get=extend_schema(
        summary="Recuperer un projet",
        description="Retourne les details d'un projet accessible.",
    ),
    put=extend_schema(
        summary="Remplacer un projet",
        description="Remplace entierement les donnees d'un projet.",
    ),
    patch=extend_schema(
        summary="Modifier un projet",
        description="Modifie partiellement les donnees d'un projet.",
    ),
    delete=extend_schema(
        summary="Supprimer un projet",
        description="Supprime un projet avec soft-delete.",
    ),
)
class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return get_accessible_projects(self.request.user)

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH"]:
            return [IsAuthenticated(), CanEditProject()]

        if self.request.method == "DELETE":
            return [IsAuthenticated(), CanDeleteProject()]

        return [IsAuthenticated()]

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)


@extend_schema_view(
    post=extend_schema(
        summary="Restaurer un projet",
        description="Restaure un projet supprime.",
    ),
)
class ProjectRestoreView(generics.GenericAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, CanRestoreProject]

    def get_queryset(self):
        return get_accessible_deleted_projects(self.request.user)

    def post(self, request, pk):
        project = self.get_object()

        project.restore()

        serializer = self.get_serializer(project)
        return Response(serializer.data)


@extend_schema_view(
    get=extend_schema(
        summary="Lister les projets supprimes",
        description="Retourne tous les projets supprimes accessibles pour l'utilisateur connecte.",
    ),
)
class ProjectTrashListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return get_accessible_deleted_projects(self.request.user)
