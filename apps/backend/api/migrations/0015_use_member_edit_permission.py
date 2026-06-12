from django.db import migrations


PERMISSION = {
    "code": "member.edit",
    "name": "permissions.member.edit.name",
    "description": "permissions.member.edit.description",
}

REMOVED_PERMISSION_CODES = [
    "member.invite",
    "member.delete",
]


def use_member_edit_permission(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    RolePermission = apps.get_model("api", "RolePermission")

    member_edit_permission, _ = Permission.objects.update_or_create(
        code=PERMISSION["code"],
        defaults={
            "name": PERMISSION["name"],
            "description": PERMISSION["description"],
        },
    )

    role_ids = (
        RolePermission.objects.filter(
            permission__code__in=REMOVED_PERMISSION_CODES,
            deleted_at__isnull=True,
        )
        .values_list("role_id", flat=True)
        .distinct()
    )

    for role_id in role_ids:
        if not RolePermission.objects.filter(
            role_id=role_id,
            permission=member_edit_permission,
            deleted_at__isnull=True,
        ).exists():
            RolePermission.objects.create(
                role_id=role_id,
                permission=member_edit_permission,
            )

    Permission.objects.filter(code__in=REMOVED_PERMISSION_CODES).delete()


def restore_previous_member_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    RolePermission = apps.get_model("api", "RolePermission")

    role_ids = (
        RolePermission.objects.filter(
            permission__code=PERMISSION["code"],
            deleted_at__isnull=True,
        )
        .values_list("role_id", flat=True)
        .distinct()
    )

    for code in REMOVED_PERMISSION_CODES:
        permission, _ = Permission.objects.update_or_create(
            code=code,
            defaults={
                "name": f"permissions.{code}.name",
                "description": f"permissions.{code}.description",
            },
        )

        for role_id in role_ids:
            if not RolePermission.objects.filter(
                role_id=role_id,
                permission=permission,
                deleted_at__isnull=True,
            ).exists():
                RolePermission.objects.create(
                    role_id=role_id,
                    permission=permission,
                )

    Permission.objects.filter(code=PERMISSION["code"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0014_seed_member_invite_permission"),
    ]

    operations = [
        migrations.RunPython(
            use_member_edit_permission,
            restore_previous_member_permissions,
        ),
    ]
