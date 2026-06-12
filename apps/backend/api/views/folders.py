from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import Document, Folder
from ..serializers import FolderSerializer, FolderTreeNodeSerializer, FolderTreeSerializer
from ..services.projects import get_accessible_projects
from ..permissions import HasProjectPermission

@extend_schema(tags=["folders"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les dossiers d'un projet",
        description=(
            "Retourne tous les dossiers actifs d'un projet.\n\n"
            "- Filtres disponibles : `parent_folder`.\n\n"
            "- Recherche disponible : `search` sur `name` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `file.view`."
        ),
    ),
    post=extend_schema(
        summary="Créer un dossier",
        description="Crée un nouveau dossier dans un projet.\nPermission requise : `file.edit`.",
    ),
)
class FolderListCreateView(generics.ListCreateAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["parent_folder"]
    search_fields = ["name", "description"]

    def get_permissions(self):
        self.permission_code = (
            "file.edit"
            if self.request.method == "POST"
            else "file.view"
        )
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Folder.objects.none()

        return Folder.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user)
        ).order_by("name", "id")

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        serializer.save(project=project)


@extend_schema(tags=["folders"])
@extend_schema_view(
    get=extend_schema(
        summary="Arbre des dossiers d'un projet",
        description="Retourne les dossiers et documents d'un projet sous forme d'arbre.\nPermission requise : `file.view`.",
        responses=FolderTreeNodeSerializer(many=True),
    )
)
class FolderTreeView(generics.GenericAPIView):
    serializer_class = FolderTreeSerializer
    queryset = Folder.objects.none()
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "file.view"

    def get(self, request, project_id):
        folders = Folder.objects.filter(
            project_id=project_id,
            project__in=get_accessible_projects(request.user),
        ).order_by("name", "id")

        documents = Document.objects.filter(
            project_id=project_id,
            project__in=get_accessible_projects(request.user),
        ).order_by("name", "id")

        serializer = self.get_serializer()
        return Response(serializer.to_representation({
            "folders": folders,
            "documents": documents,
        }))
        
@extend_schema(tags=["folders"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'un dossier",
        description="Retourne un dossier précis.\nPermission requise : `file.view`.",
    ),
    put=extend_schema(
        summary="Modifier un dossier",
        description="Modifie complètement un dossier.\nPermission requise : `file.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement un dossier",
        description="Modifie partiellement un dossier.\nPermission requise : `file.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer un dossier",
        description="Supprime un dossier.\nPermission requise : `file.delete`.",
    ),
)
class FolderDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "file.view"
        elif self.request.method in ["PUT", "PATCH"]:
            self.permission_code = "file.edit"
        elif self.request.method == "DELETE":
            self.permission_code = "file.delete"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Folder.objects.none()

        return Folder.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user)
        )

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)

@extend_schema(tags=["folders"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les dossiers supprimés",
        description=(
            "Retourne les dossiers supprimés d'un projet.\n\n"
            "- Filtres disponibles : `parent_folder`.\n\n"
            "- Recherche disponible : `search` sur `name` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `file.view`."
        ),
    )
)
class FolderTrashListView(generics.ListAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["parent_folder"]
    search_fields = ["name", "description"]

    def get_permissions(self):
        self.permission_code = "file.view"
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Folder.deleted_objects.none()

        return Folder.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user)
        ).order_by("name", "id")


@extend_schema(tags=["folders"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer un dossier",
        description="Restaure un dossier supprimé.\nPermission requise : `file.restore`.",
    )
)
class FolderRestoreView(generics.GenericAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        self.permission_code = "file.restore"
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Folder.deleted_objects.none()

        return Folder.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user)
        )

    def post(self, request, project_id, pk):
        folder = self.get_object()

        folder.restore()

        serializer = self.get_serializer(folder)
        return Response(serializer.data)
