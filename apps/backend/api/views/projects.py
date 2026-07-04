from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from drf_spectacular.utils import extend_schema, extend_schema_view

from ..authorization import OWNER_ONLY, HasProjectPermission, PermissionCodeByMethodMixin
from ..serializers import ProjectSerializer
from ..services.projects import (
    get_accessible_deleted_projects,
    get_accessible_projects,
)
from core.views import RestoreModelMixin, SoftDeleteDestroyMixin


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
class ProjectDetailView(SoftDeleteDestroyMixin, PermissionCodeByMethodMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    # GET needs no fixed code beyond project access.
    permission_codes_by_method = {"PUT": "project.edit", "PATCH": "project.edit", "DELETE": OWNER_ONLY}

    def get_queryset(self):
        return get_accessible_projects(self.request.user)


@extend_schema(tags=["projects"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer un projet",
        description="Restaure un projet supprimé. Réservé au propriétaire du projet.",
        request=None,
    ),
)
class ProjectRestoreView(RestoreModelMixin, generics.GenericAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = OWNER_ONLY

    def get_queryset(self):
        return get_accessible_deleted_projects(self.request.user)


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
    search_fields = ["name", "description"]

    def get_queryset(self):
        return get_accessible_deleted_projects(self.request.user)
