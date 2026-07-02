from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.filters import SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import Document, Folder
from ..permissions import HasProjectPermission
from ..serializers import (
    DocumentDownloadSerializer,
    DocumentSerializer,
    DocumentUploadSerializer,
)
from ..services.projects import get_accessible_projects
from ..services.storage import upload_document_file
from ..utils import FolderScopedFilterMixin
from core.views import RestoreModelMixin, SoftDeleteDestroyMixin


class DocumentFilter(FolderScopedFilterMixin, django_filters.FilterSet):
    folder = django_filters.NumberFilter(method="filter_folder")

    class Meta:
        model = Document
        fields = ["mime_type"]


@extend_schema(tags=["documents"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les documents d'un projet",
        description=(
            "Retourne tous les documents actifs d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `mime_type`.\n\n"
            "- Recherche disponible : `search` sur `name`, `description`, `file_name` et `mime_type`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `file.view`."
        ),
    ),
    post=extend_schema(
        summary="Créer un document",
        description="Upload un fichier et crée le document associé.\nPermission requise : `file.edit`.",
        request=DocumentUploadSerializer,
        responses={status.HTTP_201_CREATED: DocumentSerializer},
    ),
)
class DocumentListCreateView(generics.ListCreateAPIView):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    parser_classes = [MultiPartParser]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = DocumentFilter
    search_fields = ["name", "description", "file_name", "mime_type"]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "file.view"
        elif self.request.method == "POST":
            self.permission_code = "file.edit"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Document.objects.none()

        return Document.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).order_by("name", "id")

    def create(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get("file")

        if uploaded_file is None:
            return Response(
                {"file": ["errors.document.file_required"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = get_object_or_404(
            get_accessible_projects(request.user),
            pk=self.kwargs["project_id"],
        )

        folder = self._get_folder(request, project)
        if isinstance(folder, Response):
            return folder

        metadata = upload_document_file(uploaded_file, project.id)
        serializer = self.get_serializer(
            data={
                "folder": folder.id if folder else None,
                "name": request.data.get("name") or metadata["file_name"],
                "description": request.data.get("description"),
            }
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project, **metadata)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _get_folder(self, request, project):
        folder_id = request.data.get("folder")

        if not folder_id:
            return None

        folder = Folder.objects.filter(
            pk=folder_id,
            project=project,
        ).first()

        if folder is None:
            return Response(
                {"folder": ["errors.document.folder_not_found"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return folder


@extend_schema(tags=["documents"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'un document",
        description="Retourne un document précis.\nPermission requise : `file.view`.",
    ),
    put=extend_schema(
        summary="Modifier un document",
        description="Modifie complètement les métadonnées d'un document.\nPermission requise : `file.edit`.",
    ),
    patch=extend_schema(
        summary="Modifier partiellement un document",
        description="Modifie partiellement les métadonnées d'un document.\nPermission requise : `file.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer un document",
        description="Supprime un document via soft delete.\nPermission requise : `file.delete`.",
    ),
)
class DocumentDetailView(SoftDeleteDestroyMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DocumentSerializer
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
            return Document.objects.none()

        return Document.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        )


@extend_schema(tags=["documents"])
@extend_schema_view(
    get=extend_schema(
        summary="URL de téléchargement d'un document",
        description="Retourne une URL temporaire pour télécharger le fichier.\nPermission requise : `file.view`.",
    )
)
class DocumentDownloadView(generics.GenericAPIView):
    serializer_class = DocumentDownloadSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "file.view"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Document.objects.none()

        return Document.objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        )

    def get(self, request, project_id, pk):
        document = self.get_object()

        serializer = self.get_serializer(document)
        return Response(serializer.data)


@extend_schema(tags=["documents"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les documents supprimés",
        description=(
            "Retourne les documents supprimés d'un projet.\n\n"
            "- Filtres disponibles : `folder` (dossier et sous-dossiers), `mime_type`.\n\n"
            "- Recherche disponible : `search` sur `name`, `description`, `file_name` et `mime_type`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `file.restore`."
        ),
    )
)
class DocumentTrashListView(generics.ListAPIView):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = DocumentFilter
    search_fields = ["name", "description", "file_name", "mime_type"]

    def get_permissions(self):
        self.permission_code = "file.restore"
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Document.deleted_objects.none()

        return Document.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        ).order_by("name", "id")


@extend_schema(tags=["documents"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer un document",
        description="Restaure un document supprimé. Le fichier en stockage n'est pas supprimé.\nPermission requise : `file.restore`.",
        request=None,
    )
)
class DocumentRestoreView(RestoreModelMixin, generics.GenericAPIView):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "file.restore"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Document.deleted_objects.none()

        return Document.deleted_objects.filter(
            project_id=self.kwargs["project_id"],
            project__in=get_accessible_projects(self.request.user),
        )
