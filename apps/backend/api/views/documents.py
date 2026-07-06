from django.shortcuts import get_object_or_404

from rest_framework import generics, serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import Document
from ..authorization import HasProjectPermission, PermissionCodeByMethodMixin
from ..serializers import (
    DocumentDownloadBatchItemSerializer,
    DocumentDownloadBatchRequestSerializer,
    DocumentDownloadSerializer,
    DocumentSerializer,
    DocumentUploadSerializer,
)
from ..services.documents import get_project_deleted_documents, get_project_documents
from ..services.projects import get_accessible_projects
from ..services.storage import upload_document_file
from ..utils import FolderScopedFilterSet
from core.views import RestoreModelMixin, SoftDeleteDestroyMixin


class DocumentFilter(FolderScopedFilterSet):
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
class DocumentListCreateView(PermissionCodeByMethodMixin, generics.ListCreateAPIView):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {"GET": "file.view", "POST": "file.edit"}
    parser_classes = [MultiPartParser]
    filterset_class = DocumentFilter
    search_fields = ["name", "description", "file_name", "mime_type"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Document.objects.none()

        return get_project_documents(self.request.user, self.kwargs["project_id"]).order_by("name", "id")

    def create(self, request, *args, **kwargs):
        upload_serializer = DocumentUploadSerializer(data=request.data)
        upload_serializer.is_valid(raise_exception=True)
        upload_data = upload_serializer.validated_data

        project = get_object_or_404(
            get_accessible_projects(request.user),
            pk=self.kwargs["project_id"],
        )

        folder = self._get_folder(upload_data.get("folder"), project)

        metadata = upload_document_file(upload_data["file"], project.id)
        serializer = self.get_serializer(
            data={
                "folder": folder.id if folder else None,
                "name": upload_data.get("name") or metadata["file_name"],
                "description": upload_data.get("description"),
            }
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project, **metadata)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _get_folder(self, folder, project):
        if folder is None:
            return None

        if folder.project_id != project.id:
            raise serializers.ValidationError({"folder": ["errors.document.folder_not_found"]})

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
class DocumentDetailView(SoftDeleteDestroyMixin, PermissionCodeByMethodMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {
        "GET": "file.view",
        "PUT": "file.edit",
        "PATCH": "file.edit",
        "DELETE": "file.delete",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Document.objects.none()

        return get_project_documents(self.request.user, self.kwargs["project_id"])


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

        return get_project_documents(self.request.user, self.kwargs["project_id"])

    def get(self, request, project_id, pk):
        document = self.get_object()

        serializer = self.get_serializer(document)
        return Response(serializer.data)


@extend_schema(
    tags=["documents"],
    summary="URLs de téléchargement pour un lot de documents",
    description=(
        "Retourne une URL temporaire par document pour un lot d'identifiants.\n\n"
        "Évite d'appeler l'endpoint de téléchargement un par un pour afficher des "
        "miniatures (ex. arbre de fichiers, photos jointes à une tâche).\n\n"
        "Permission requise : `file.view`."
    ),
    request=DocumentDownloadBatchRequestSerializer,
    responses={status.HTTP_200_OK: DocumentDownloadBatchItemSerializer(many=True)},
)
class DocumentDownloadBatchView(generics.GenericAPIView):
    serializer_class = DocumentDownloadBatchRequestSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "file.view"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Document.objects.none()

        return get_project_documents(self.request.user, self.kwargs["project_id"])

    def post(self, request, project_id):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        documents = self.get_queryset().filter(id__in=serializer.validated_data["ids"])
        return Response(DocumentDownloadBatchItemSerializer(documents, many=True).data)


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
    permission_code = "file.restore"
    filterset_class = DocumentFilter
    search_fields = ["name", "description", "file_name", "mime_type"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Document.deleted_objects.none()

        return get_project_deleted_documents(self.request.user, self.kwargs["project_id"]).order_by("name", "id")


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

        return get_project_deleted_documents(self.request.user, self.kwargs["project_id"])
