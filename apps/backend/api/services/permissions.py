from ..models import Permission, ProjectMember


PERMISSION_DEPENDENCY_CODES = {
    "role.edit": ["role.view"],
    "role.delete": ["role.view"],
    "role.restore": ["role.view"],
    "member.edit": ["member.view"],
    "file.edit": ["file.view"],
    "file.delete": ["file.view"],
    "file.restore": ["file.view"],
    "task.edit": ["task.view"],
    "task.delete": ["task.view"],
    "task.restore": ["task.view"],
    "time_entry.view_all": ["time_entry.view"],
    "time_entry.edit": ["time_entry.view"],
    "time_entry.delete": ["time_entry.view"],
    "time_entry.restore": ["time_entry.view"],
    "time_entry.pay": ["time_entry.view", "time_entry.view_all"],
    "finance.edit": ["finance.view"],
    "finance.delete": ["finance.view"],
    "finance.restore": ["finance.view"],
}


def get_permissions():
    return Permission.objects.all().order_by("id")


def expand_permission_codes(permission_codes):
    expanded_codes = set(permission_codes)
    changed = True

    while changed:
        changed = False

        for code in list(expanded_codes):
            for dependency_code in PERMISSION_DEPENDENCY_CODES.get(code, []):
                if dependency_code not in expanded_codes:
                    expanded_codes.add(dependency_code)
                    changed = True

    return sorted(expanded_codes)


def expand_permissions(permissions):
    permission_codes = [permission.code for permission in permissions]
    return Permission.objects.filter(code__in=expand_permission_codes(permission_codes))


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
