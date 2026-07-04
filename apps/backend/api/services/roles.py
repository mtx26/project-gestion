from ..models import Permission, Role


def get_project_roles(user, project_id):
    return Role.objects.for_project(project_id).accessible_to(user).with_relations().order_by("id")


def get_project_deleted_roles(user, project_id):
    return Role.deleted_objects.for_project(project_id).accessible_to(user).with_relations().order_by("id")


# Permission-dependency graph used only when creating/editing a role's permission
# set (`RoleSerializer._set_permissions`) — ticking `time_entry.pay` also ticks its
# prerequisites so the role stays internally consistent. Has nothing to do with
# authorization at request time (see `services/permissions.py` for that).
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


def get_role_permissions_map(roles):
    """Same result as calling `RoleSerializer.get_permissions` per role, batched.

    Avoids one query per role when serializing a list (e.g. `GET .../roles/`):
    one query covers every role's active permissions instead of N. Purely a
    display concern (what a role is configured with) — not authorization.
    """
    role_ids = [role.id for role in roles]
    if not role_ids:
        return {}

    rows = Permission.objects.filter(
        rolepermission__role_id__in=role_ids,
        rolepermission__deleted_at__isnull=True,
    ).values("rolepermission__role_id", "id", "code", "name", "description")

    permissions_by_role = {}
    for row in rows:
        role_id = row.pop("rolepermission__role_id")
        permissions_by_role.setdefault(role_id, []).append(row)

    return permissions_by_role
