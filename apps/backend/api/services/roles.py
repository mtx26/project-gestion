from ..models import Role
from .permissions import filter_allowed_project


MANAGE_ROLES_PERMISSION = "project.manage_roles"


def get_project_roles(user, project_id):
    return filter_allowed_project(
        Role.objects.select_related("project"),
        user,
        project_id,
        permission_code=MANAGE_ROLES_PERMISSION,
    )
    
def get_deleted_project_roles(user, project_id):
    return filter_allowed_project(
        Role.deleted_objects.select_related("project"),
        user,
        project_id,
        permission_code=MANAGE_ROLES_PERMISSION,
    )
