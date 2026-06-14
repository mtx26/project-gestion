from django.db import migrations


ACTIVE_PERMISSIONS = [
    "project.edit",
    "project.restore",
    "role.view",
    "role.edit",
    "role.delete",
    "role.restore",
    "member.view",
    "member.edit",
    "file.view",
    "file.edit",
    "file.delete",
    "file.restore",
    "task.view",
    "task.edit",
    "task.delete",
    "task.restore",
    "time_entry.view",
    "time_entry.view_all",
    "time_entry.edit",
    "time_entry.pay",
    "time_entry.delete",
    "time_entry.restore",
    "finance.view",
    "finance.edit",
    "finance.delete",
    "finance.restore",
]


def seed_active_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")

    for code in ACTIVE_PERMISSIONS:
        Permission.objects.update_or_create(
            code=code,
            defaults={
                "name": f"permissions.{code}.name",
                "description": f"permissions.{code}.description",
            },
        )


def remove_seeded_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(code__in=ACTIVE_PERMISSIONS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0023_remove_project_delete_permission"),
    ]

    operations = [
        migrations.RunPython(
            seed_active_permissions,
            remove_seeded_permissions,
        ),
    ]
