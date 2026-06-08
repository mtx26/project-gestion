from ..models import Role
from .projects import get_accessible_projects


def get_project_roles(user, project_id):
    return Role.objects.filter(
        project_id=project_id,
        project__in=get_accessible_projects(user)
    ).select_related("project")
    
def get_deleted_project_roles(user, project_id):
    return Role.all_objects.filter(
        project_id=project_id,
        project__in=get_accessible_projects(user),
        deleted_at__isnull=False
    ).select_related("project")