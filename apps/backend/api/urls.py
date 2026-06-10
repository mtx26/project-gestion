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
from .views.users import UserListView
from .views.folders import (
    FolderListCreateView,
    FolderDetailView,
    FolderTrashListView,
    FolderRestoreView
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
    # Folders
    path("projects/<int:project_id>/folders/", FolderListCreateView.as_view(), name="project-folders"),
    path("projects/<int:project_id>/folders/<int:pk>", FolderDetailView.as_view(), name="project-folders"),
    path("projects/<int:project_id>/folders/trash/", FolderTrashListView.as_view(), name="project-folders"),
    path("projects/<int:project_id>/folders/<int:pk>/restore/", FolderRestoreView.as_view(), name="project-folders"),

]
