from django.urls import path
from .views.projects import (
    ProjectListCreateView,
    ProjectDetailView,
    ProjectRestoreView,
    ProjectTrashListView
)
from .views.roles import (
    PermissionListView,
    RoleListCreateView,
    RoleDetailView,
    RoleRestoreView,
    RoleTrashListView
)
from .views.members import (
    ProjectMemberListView,
    ProjectMemberDetailView
)
from .views.invitations import (
    InvitationAcceptView,
    InvitationDetailView,
    InvitationListCreateView,
)
from .views.users import UserListView
from .views.folders import (
    FolderListCreateView,
    FolderDetailView,
    FolderTrashListView,
    FolderRestoreView,
    FolderTreeView,
)
from .views.documents import (
    DocumentListCreateView,
    DocumentDetailView,
    DocumentDownloadView,
    DocumentTrashListView,
    DocumentRestoreView,
)
from .views.tasks import (
    TaskListCreateView,
    TaskDetailView,
    TaskTrashListView,
    TaskRestoreView,
)
    

urlpatterns = [
    path("users/", UserListView.as_view(), name="user-list"),
    # Projects
    path("projects/", ProjectListCreateView.as_view(), name="project-list-create"),
    path("projects/<int:pk>/", ProjectDetailView.as_view(), name="project-detail"),
    path("projects/trash/", ProjectTrashListView.as_view(), name="project-trash-list"),
    path("projects/<int:pk>/restore/", ProjectRestoreView.as_view(), name="project-restore"),
    # Roles
    path("projects/<int:project_id>/roles/", RoleListCreateView.as_view(), name="project-roles"),
    path("projects/<int:project_id>/roles/<int:pk>/", RoleDetailView.as_view(), name="project-role-detail"),
    path("projects/<int:project_id>/roles/trash/", RoleTrashListView.as_view(), name="project-role-trash-list"),
    path("projects/<int:project_id>/roles/<int:pk>/restore/", RoleRestoreView.as_view(), name="project-role-restore"),
    path("permissions/", PermissionListView.as_view(), name="permission-list"),
    # Members
    path("projects/<int:project_id>/members/", ProjectMemberListView.as_view(), name="project-members"),
    path("projects/<int:project_id>/members/<int:pk>/", ProjectMemberDetailView.as_view(), name="project-member-detail"),
    path("projects/<int:project_id>/invitations/", InvitationListCreateView.as_view(), name="project-invitations"),
    path("projects/<int:project_id>/invitations/<int:pk>/", InvitationDetailView.as_view(), name="project-invitation-detail"),
    path("invitations/accept/", InvitationAcceptView.as_view(), name="invitation-accept"),
    # Folders
    path("projects/<int:project_id>/folders/", FolderListCreateView.as_view(), name="project-folders"),
    path("projects/<int:project_id>/folders/tree/", FolderTreeView.as_view(), name="project-folder-tree"),
    path("projects/<int:project_id>/folders/<int:pk>", FolderDetailView.as_view(), name="project-folders"),
    path("projects/<int:project_id>/folders/trash/", FolderTrashListView.as_view(), name="project-folders"),
    path("projects/<int:project_id>/folders/<int:pk>/restore/", FolderRestoreView.as_view(), name="project-folders"),
    # Documents
    path("projects/<int:project_id>/documents/", DocumentListCreateView.as_view(), name="project-documents"),
    path("projects/<int:project_id>/documents/trash/", DocumentTrashListView.as_view(), name="project-documents-trash"),
    path("projects/<int:project_id>/documents/<int:pk>/", DocumentDetailView.as_view(), name="project-document-detail"),
    path("projects/<int:project_id>/documents/<int:pk>/download/", DocumentDownloadView.as_view(), name="project-document-download"),
    path("projects/<int:project_id>/documents/<int:pk>/restore/", DocumentRestoreView.as_view(), name="project-document-restore"),
    # Tasks
    path("projects/<int:project_id>/tasks/", TaskListCreateView.as_view(), name="project-tasks"),
    path("projects/<int:project_id>/tasks/trash/", TaskTrashListView.as_view(), name="project-tasks-trash"),
    path("projects/<int:project_id>/tasks/<int:pk>/", TaskDetailView.as_view(), name="project-task-detail"),
    path("projects/<int:project_id>/tasks/<int:pk>/restore/", TaskRestoreView.as_view(), name="project-task-restore"),

]
