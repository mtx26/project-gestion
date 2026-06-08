# services/permissions.py

from ..models import ProjectMember


def has_project_permission(user, project, permission_code):
    if not user or not user.is_authenticated:
        return False

    if project.owner_id == user.id:
        return True

    return ProjectMember.objects.filter(
        project=project,
        user=user,
        role__rolepermission__permission__code=permission_code
    ).exists()
