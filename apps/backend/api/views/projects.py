from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema, extend_schema_view

from ..permissions import HasProjectPermission
from ..serializers import ProjectSerializer
from ..services.projects import (
    get_accessible_deleted_projects,
    get_accessible_projects,
)


@extend_schema(tags=["projects"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les projets",
        description=(
            "Retourne tous les projets accessibles pour l'utilisateur connecté.\n\n"
            "- Recherche disponible : `search` sur `name` et `description`.\n\n"
            "- Pagination disponible : `page`."
        ),
    ),
    post=extend_schema(
        summary="Créer un projet",
        description="Crée un nouveau projet pour l'utilisateur connecté.",
    ),
)
class ProjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer
    filter_backends = [SearchFilter]
    search_fields = ["name", "description"]

    def get_queryset(self):
        return get_accessible_projects(self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


@extend_schema(tags=["projects"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'un projet",
        description="Retourne un projet précis.",
    ),
    put=extend_schema(
        summary="Modifier un projet",
        description="Modifie complètement les données d'un projet.\nPermission requise : `project.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement un projet",
        description="Modifie partiellement les données d'un projet.\nPermission requise : `project.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer un projet",
        description="Supprime un projet via soft delete. Réservé au propriétaire du projet.",
    ),
)
class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = None
        elif self.request.method in ["PUT", "PATCH"]:
            self.permission_code = "project.edit"
        elif self.request.method == "DELETE":
            self.permission_code = None

        return super().get_permissions()

    def get_queryset(self):
        return get_accessible_projects(self.request.user)

    def perform_destroy(self, instance):
        if instance.owner_id != self.request.user.id:
            raise PermissionDenied("Seul le proprietaire du projet peut le supprimer.")

        instance.soft_delete(self.request.user)


@extend_schema(tags=["projects"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer un projet",
        description="Restaure un projet supprimé. Réservé au propriétaire du projet.",
        request=None,
    ),
)
class ProjectRestoreView(generics.GenericAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return get_accessible_deleted_projects(self.request.user)

    def post(self, request, pk):
        project = self.get_object()
        if project.owner_id != request.user.id:
            raise PermissionDenied("Seul le proprietaire du projet peut le restaurer.")

        project.restore()

        serializer = self.get_serializer(project)
        return Response(serializer.data)


@extend_schema(tags=["projects"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les projets supprimés",
        description=(
            "Retourne tous les projets supprimés accessibles pour l'utilisateur connecté.\n\n"
            "- Recherche disponible : `search` sur `name` et `description`.\n\n"
            "- Pagination disponible : `page`."
        ),
    ),
)
class ProjectTrashListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer
    filter_backends = [SearchFilter]
    search_fields = ["name", "description"]

    def get_queryset(self):
        return get_accessible_deleted_projects(self.request.user)
