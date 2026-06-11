from django.db import migrations


FILE_PERMISSIONS = [
    {
        "code": "file.view",
        "name": "permissions.file.view.name",
        "description": "permissions.file.view.description",
        "source_codes": ["folder.view", "document.view"],
    },
    {
        "code": "file.edit",
        "name": "permissions.file.edit.name",
        "description": "permissions.file.edit.description",
        "source_codes": ["folder.edit", "document.edit"],
    },
    {
        "code": "file.delete",
        "name": "permissions.file.delete.name",
        "description": "permissions.file.delete.description",
        "source_codes": ["folder.delete", "document.delete"],
    },
    {
        "code": "file.restore",
        "name": "permissions.file.restore.name",
        "description": "permissions.file.restore.description",
        "source_codes": ["folder.restore", "document.restore"],
    },
]


LEGACY_PERMISSION_CODES = [
    source_code
    for permission in FILE_PERMISSIONS
    for source_code in permission["source_codes"]
]


def merge_file_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    RolePermission = apps.get_model("api", "RolePermission")

    for permission_data in FILE_PERMISSIONS:
        file_permission, _ = Permission.objects.update_or_create(
            code=permission_data["code"],
            defaults={
                "name": permission_data["name"],
                "description": permission_data["description"],
            },
        )

        role_ids = (
            RolePermission.objects.filter(
                permission__code__in=permission_data["source_codes"],
                deleted_at__isnull=True,
            )
            .values_list("role_id", flat=True)
            .distinct()
        )

        for role_id in role_ids:
            RolePermission.objects.get_or_create(
                role_id=role_id,
                permission=file_permission,
                deleted_at__isnull=True,
            )

    Permission.objects.filter(code__in=LEGACY_PERMISSION_CODES).delete()


def restore_legacy_file_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    RolePermission = apps.get_model("api", "RolePermission")

    for permission_data in FILE_PERMISSIONS:
        role_ids = (
            RolePermission.objects.filter(
                permission__code=permission_data["code"],
                deleted_at__isnull=True,
            )
            .values_list("role_id", flat=True)
            .distinct()
        )

        for source_code in permission_data["source_codes"]:
            source_scope = source_code.split(".", 1)[0]
            source_action = source_code.split(".", 1)[1]
            source_permission, _ = Permission.objects.update_or_create(
                code=source_code,
                defaults={
                    "name": f"permissions.{source_scope}.{source_action}.name",
                    "description": f"permissions.{source_scope}.{source_action}.description",
                },
            )

            for role_id in role_ids:
                RolePermission.objects.get_or_create(
                    role_id=role_id,
                    permission=source_permission,
                    deleted_at__isnull=True,
                )

    Permission.objects.filter(
        code__in=[permission["code"] for permission in FILE_PERMISSIONS]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_normalize_action_permissions"),
    ]

    operations = [
        migrations.RunPython(
            merge_file_permissions,
            restore_legacy_file_permissions,
        ),
    ]
