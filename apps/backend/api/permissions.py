from rest_framework.permissions import BasePermission

from .services.permissions import get_allowed_project


class ProjectPermission(BasePermission):
    permission_code = None
    include_deleted = False

    def has_permission(self, request, view):
        if self.permission_code is None:
            return False

        project_id = view.kwargs.get("project_id") or view.kwargs.get("pk")
        if project_id is None:
            return True

        return get_allowed_project(
            request.user,
            project_id,
            permission_code=self.permission_code,
            deleted=self.include_deleted,
        ).exists()

    def has_object_permission(self, request, view, obj):
        if self.permission_code is None:
            return False

        project = getattr(obj, "permission_project", obj)

        return get_allowed_project(
            request.user,
            project.pk,
            permission_code=self.permission_code,
            deleted=self.include_deleted,
        ).exists()

# Project
class CanEditProject(ProjectPermission):
    permission_code = "project.edit"


class CanDeleteProject(ProjectPermission):
    permission_code = "project.delete"


class CanRestoreProject(ProjectPermission):
    permission_code = "project.restore"
    include_deleted = True

# Roles
class CanManageRoles(ProjectPermission):
    permission_code = "project.manage_roles"
