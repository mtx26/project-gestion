from ..models import ProjectMember
from .permissions import filter_allowed_project
    
def get_project_members(user, project_id):
    return filter_allowed_project(
        ProjectMember.objects.select_related("user", "role"),
        user,
        project_id,
    )

def get_deleted_project_members(user, project_id):
    return filter_allowed_project(
        ProjectMember.deleted_objects.select_related("user", "role"),
        user,
        project_id,
    )
