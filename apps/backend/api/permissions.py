from rest_framework.permissions import BasePermission

from .services.permissions import has_project_permission


class ProjectPermission(BasePermission):
    permission_code = None

    def has_object_permission(self, request, view, obj):
        if self.permission_code is None:
            return False

        return has_project_permission(
            request.user,
            obj,
            self.permission_code
        )


class CanEditProject(ProjectPermission):
    permission_code = "project.edit"


class CanDeleteProject(ProjectPermission):
    permission_code = "project.delete"


class CanRestoreProject(ProjectPermission):
    permission_code = "project.restore"