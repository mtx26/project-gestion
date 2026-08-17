from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from drf_spectacular.utils import extend_schema, extend_schema_view

from ..models import Document, Folder, Task
from ..serializers import (
    FolderSerializer,
    FolderTreeNodeSerializer,
    FolderTreeQuerySerializer,
    FolderTreeSerializer,
)
from ..services.documents import get_project_documents
from ..services.folders import (
    get_project_deleted_folders,
    get_project_folders,
)
from ..services.projects import get_accessible_projects
from ..authorization import HasProjectPermission, PermissionCodeByMethodMixin, ProjectAuthorization
from core.views import RestoreModelMixin, SoftDeleteDestroyMixin

@extend_schema(tags=["folders"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les dossiers d'un projet",
        description=(
            "Retourne tous les dossiers actifs d'un projet.\n\n"
            "- Filtres disponibles : `parent_folder` (dossier parent direct).\n\n"
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
class FolderListCreateView(PermissionCodeByMethodMixin, generics.ListCreateAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {"GET": "file.view", "POST": "file.edit"}
    filterset_fields = ["parent_folder"]
    search_fields = ["name", "description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Folder.objects.none()

        return get_project_folders(self.request.user, self.kwargs["project_id"]).order_by("name", "id")

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        serializer.save(project=project, created_by=self.request.user)


@extend_schema(tags=["folders"])
@extend_schema_view(
    get=extend_schema(
        summary="Arbre des dossiers d'un projet",
        description=(
            "Retourne l'arborescence d'un projet, utilisée aussi bien comme explorateur de fichiers "
            "que comme filtre dossier ou sélecteur de cible (projet / dossier / tâche) par toutes les "
            "sections : fichiers, tâches, temps, finance, remboursements.\n\n"
            "- Paramètre disponible : `include_files=false` — exclut les documents de la réponse.\n\n"
            "- Paramètre disponible : `include_tasks=true` — inclut les tâches si l'utilisateur a la permission `task.view`.\n\n"
            "- Paramètre disponible : `task_scope=open|all` (défaut `open`) — `open` ne garde que les tâches "
            "à faire ou en cours, triées par échéance (vue de travail) ; `all` retourne toutes les tâches, "
            "triées par titre (sélecteur de cible : on peut rattacher une écriture à une tâche terminée).\n\n"
            "- Permission requise : appartenir au projet. Les documents ne sont inclus qu'avec `file.view` "
            "et les tâches qu'avec `task.view` : chaque section est filtrée selon les droits, la structure "
            "de dossiers elle-même étant visible par tout membre."
        ),
        responses=FolderTreeNodeSerializer(many=True),
        parameters=[FolderTreeQuerySerializer],
    )
)
class FolderTreeView(generics.GenericAPIView):
    """Pas de `permission_code` unique : l'arbre sert de filtre commun a toutes les
    sections, donc le gater sur `file.view` priverait de filtre dossier un membre qui a
    `finance.view` ou `time_entry.view` sans acces aux fichiers. Le contenu sensible est
    filtre section par section ci-dessous — meme approche que `ProjectCalendarView`."""

    serializer_class = FolderTreeSerializer
    queryset = Folder.objects.none()
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get(self, request, project_id):
        query_serializer = FolderTreeQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        params = query_serializer.validated_data

        folders = get_project_folders(request.user, project_id).order_by("name", "id")

        project = get_object_or_404(get_accessible_projects(request.user), pk=project_id)
        auth = ProjectAuthorization(request.user, project)

        if params["include_files"] and auth.has("file.view"):
            documents = get_project_documents(request.user, project_id).order_by("name", "id")
        else:
            documents = Document.objects.none()

        if params["include_tasks"] and auth.has("task.view"):
            tasks = Task.objects.filter(project_id=project_id)
            if params["task_scope"] == "open":
                tasks = tasks.filter(status__in=["todo", "in_progress"]).order_by("end_date", "title", "id")
            else:
                tasks = tasks.order_by("title", "id")
        else:
            tasks = Task.objects.none()

        serializer = self.get_serializer()
        return Response(serializer.to_representation({
            "folders": folders,
            "documents": documents,
            "tasks": tasks,
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
        description="Supprime un dossier via soft delete.\nPermission requise : `file.delete`.",
    ),
)
class FolderDetailView(SoftDeleteDestroyMixin, PermissionCodeByMethodMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_codes_by_method = {
        "GET": "file.view",
        "PUT": "file.edit",
        "PATCH": "file.edit",
        "DELETE": "file.delete",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Folder.objects.none()

        return get_project_folders(self.request.user, self.kwargs["project_id"])

@extend_schema(tags=["folders"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les dossiers supprimés",
        description=(
            "Retourne les dossiers supprimés d'un projet.\n\n"
            "- Filtres disponibles : `parent_folder` (dossier parent direct).\n\n"
            "- Recherche disponible : `search` sur `name` et `description`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `file.restore`."
        ),
    )
)
class FolderTrashListView(generics.ListAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "file.restore"
    filterset_fields = ["parent_folder"]
    search_fields = ["name", "description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Folder.deleted_objects.none()

        return get_project_deleted_folders(self.request.user, self.kwargs["project_id"]).order_by("name", "id")


@extend_schema(tags=["folders"])
@extend_schema_view(
    post=extend_schema(
        summary="Restaurer un dossier",
        request=None,
        description="Restaure un dossier supprimé.\nPermission requise : `file.restore`.",
    )
)
class FolderRestoreView(RestoreModelMixin, generics.GenericAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "file.restore"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Folder.deleted_objects.none()

        return get_project_deleted_folders(self.request.user, self.kwargs["project_id"])
