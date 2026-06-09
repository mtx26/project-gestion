from ..models import ProjectMember
from .projects import get_accessible_projects


def get_project_members(user, project_id):
    return ProjectMember.objects.select_related("user", "role").filter(
        project_id=project_id,
        project__in=get_accessible_projects(user),
    )
