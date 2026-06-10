from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import Folder
from ..serializers import FolderSerializer
from ..services.projects import get_accessible_projects
from ..permissions import HasProjectPermission

@extend_schema(tags=["folders"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les dossiers d'un projet",
        description="Retourne tous les dossiers actifs d'un projet.\nPermission requise : `folder.view`.",
    ),
    post=extend_schema(
        summary="Créer un dossier",
        description="Crée un nouveau dossier dans un projet.\nPermission requise : `folder.create`.",
    ),
)
class FolderListCreateView(generics.ListCreateAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        self.permission_code = (
            "folder.create"
            if self.request.method == "POST"
            else "folder.view"
        )
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Folder.objects.none()

        return Folder.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user)
        ).order_by("id")

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        serializer.save(project=project)
        
@extend_schema(tags=["folders"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'un dossier",
        description="Retourne un dossier précis.\nPermission requise : `folder.view`.",
    ),
    put=extend_schema(
        summary="Modifier un dossier",
        description="Modifie complètement un dossier.\nPermission requise : `folder.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement un dossier",
        description="Modifie partiellement un dossier.\nPermission requise : `folder.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer un dossier",
        description="Supprime un dossier.\nPermission requise : `folder.delete`.",
    ),
)
class FolderDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "folder.view"
        elif self.request.method in ["PUT", "PATCH"]:
            self.permission_code = "folder.edit"
        elif self.request.method == "DELETE":
            self.permission_code = "folder.delete"

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
        description="Retourne les dossiers supprimés d'un projet.\nPermission requise : `folder.view_trash`.",
    )
)
class FolderTrashListView(generics.ListAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        self.permission_code = "folder.view_trash"
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Folder.deleted_objects.none()

        return Folder.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user)
        ).order_by("id")


@extend_schema(tags=["folders"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer un dossier",
        description="Restaure un dossier supprimé.\nPermission requise : `folder.restore`.",
    )
)
class FolderRestoreView(generics.GenericAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        self.permission_code = "folder.restore"
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
