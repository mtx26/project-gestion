from ..models import Permission


PERMISSION_DEPENDENCY_CODES = {
    "role.edit": ["role.view"],
    "role.delete": ["role.view"],
    "role.restore": ["role.view"],
    "member.edit": ["member.view"],
    "member.edit_own_rate": [],
    "member.edit_rates": ["member.view"],
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

    return Permission.objects.for_user_on_project(user, project).filter(code=permission_code).exists()


def get_project_permission_codes(user, project):
    return list(
        Permission.objects.for_user_on_project(user, project)
        .order_by("code")
        .values_list("code", flat=True)
        .distinct()
    )


def get_project_permission_codes_map(user, projects):
    """Same result as calling `get_project_permission_codes` per project, batched.

    Avoids one query per project when serializing a list: one query covers the
    "all codes" case (shared by every project the user owns) and one covers every
    project where the user is a member.
    """
    projects = list(projects)

    if not user or not user.is_authenticated:
        return {project.id: [] for project in projects}

    owned_ids = {project.id for project in projects if project.owner_id == user.id}
    member_ids = [project.id for project in projects if project.id not in owned_ids]

    codes_by_project = {}

    if owned_ids:
        all_codes = list(Permission.objects.order_by("code").values_list("code", flat=True))
        for project_id in owned_ids:
            codes_by_project[project_id] = all_codes

    if member_ids:
        member_codes = {}
        rows = Permission.objects.filter(
            rolepermission__role__projectmember__project_id__in=member_ids,
            rolepermission__role__projectmember__user=user,
            rolepermission__deleted_at__isnull=True,
            rolepermission__role__projectmember__deleted_at__isnull=True,
        ).values_list("rolepermission__role__projectmember__project_id", "code").distinct()

        for project_id, code in rows:
            member_codes.setdefault(project_id, set()).add(code)

        for project_id in member_ids:
            codes_by_project[project_id] = sorted(member_codes.get(project_id, set()))

    return codes_by_project
