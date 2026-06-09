from rest_framework.permissions import BasePermission

from .models import Project
from .services.permissions import has_project_permission
from .services.projects import get_accessible_projects


class HasProjectPermission(BasePermission):
    def has_permission(self, request, view):
        project_id = view.kwargs.get("project_id")
        permission_code = getattr(view, "permission_code", None)

        if project_id is None:
            return True

        project = get_accessible_projects(request.user).filter(pk=project_id).first()
        if project is None:
            return False

        return has_project_permission(request.user, project, permission_code)

    def has_object_permission(self, request, view, obj):
        permission_code = getattr(view, "permission_code", None)
        project = obj if isinstance(obj, Project) else getattr(obj, "project", None)

        if project is None:
            return False

        if not get_accessible_projects(request.user).filter(pk=project.pk).exists():
            return False

        return has_project_permission(request.user, project, permission_code)
