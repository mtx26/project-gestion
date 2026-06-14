from ..models import Permission, ProjectMember


def get_permissions():
    return Permission.objects.all().order_by("id")


def has_project_permission(user, project, permission_code):
    if not permission_code:
        return False

    if user and user.is_authenticated and project and project.owner_id == user.id:
        return True

    if not user or not user.is_authenticated or project is None:
        return False

    return ProjectMember.objects.filter(
        project=project,
        user=user,
        role__rolepermission__permission__code=permission_code,
        role__rolepermission__deleted_at__isnull=True,
    ).exists()


def get_project_permission_codes(user, project):
    if not user or not user.is_authenticated or project is None:
        return []

    if project.owner_id == user.id:
        return list(Permission.objects.order_by("code").values_list("code", flat=True))

    return list(
        Permission.objects.filter(
            rolepermission__role__projectmember__project=project,
            rolepermission__role__projectmember__user=user,
            rolepermission__deleted_at__isnull=True,
            rolepermission__role__projectmember__deleted_at__isnull=True,
        )
        .order_by("code")
        .values_list("code", flat=True)
        .distinct()
    )
