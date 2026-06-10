from ..models import Role
from .projects import get_accessible_projects


def get_project_roles(user, project_id):
    return Role.objects.select_related("project").filter(
        project_id=project_id,
        project__in=get_accessible_projects(user),
    ).order_by("id")


def get_deleted_project_roles(user, project_id):
    return Role.deleted_objects.select_related("project").filter(
        project_id=project_id,
        project__in=get_accessible_projects(user),
    ).order_by("id")
