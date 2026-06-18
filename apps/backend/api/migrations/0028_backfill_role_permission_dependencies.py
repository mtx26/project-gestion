from django.db import migrations


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

    return expanded_codes


def backfill_role_permission_dependencies(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Role = apps.get_model("api", "Role")
    RolePermission = apps.get_model("api", "RolePermission")

    permissions_by_code = {
        permission.code: permission
        for permission in Permission.objects.filter(
            code__in=set(PERMISSION_DEPENDENCY_CODES)
            | {
                dependency_code
                for dependency_codes in PERMISSION_DEPENDENCY_CODES.values()
                for dependency_code in dependency_codes
            },
        )
    }

    for role in Role.objects.all():
        current_codes = set(
            Permission.objects.filter(
                rolepermission__role=role,
                rolepermission__deleted_at__isnull=True,
            ).values_list("code", flat=True)
        )
        missing_codes = expand_permission_codes(current_codes) - current_codes

        RolePermission.objects.bulk_create(
            [
                RolePermission(role=role, permission=permissions_by_code[code])
                for code in missing_codes
                if code in permissions_by_code
            ],
            ignore_conflicts=True,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0027_seed_time_entry_view_all_and_pay_permissions"),
    ]

    operations = [
        migrations.RunPython(
            backfill_role_permission_dependencies,
            noop_reverse,
        ),
    ]
