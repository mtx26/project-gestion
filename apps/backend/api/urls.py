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
    

urlpatterns = [
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
]
