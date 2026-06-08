from rest_framework.permissions import BasePermission

from .models import Project
from .services.permissions import has_project_permission


class ProjectPermission(BasePermission):
    permission_code = None

    def has_permission(self, request, view):
        if self.permission_code is None:
            return False

        project_id = view.kwargs.get("project_id")
        if project_id is None:
            return True

        project = Project.objects.filter(pk=project_id).first()
        if project is None:
            return False

        return has_project_permission(
            request.user,
            project,
            self.permission_code
        )

    def has_object_permission(self, request, view, obj):
        if self.permission_code is None:
            return False

        project = getattr(obj, "permission_project", obj)

        return has_project_permission(
            request.user,
            project,
            self.permission_code
        )


class CanEditProject(ProjectPermission):
    permission_code = "project.edit"


class CanDeleteProject(ProjectPermission):
    permission_code = "project.delete"


class CanRestoreProject(ProjectPermission):
    permission_code = "project.restore"


class CanManageRoles(ProjectPermission):
    permission_code = "project.manage_roles"
