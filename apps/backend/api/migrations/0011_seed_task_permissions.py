from django.db import migrations


TASK_PERMISSIONS = [
    {
        "code": "task.view",
        "name": "permissions.task.view.name",
        "description": "permissions.task.view.description",
    },
    {
        "code": "task.edit",
        "name": "permissions.task.edit.name",
        "description": "permissions.task.edit.description",
    },
    {
        "code": "task.delete",
        "name": "permissions.task.delete.name",
        "description": "permissions.task.delete.description",
    },
    {
        "code": "task.restore",
        "name": "permissions.task.restore.name",
        "description": "permissions.task.restore.description",
    },
]


def seed_task_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")

    for permission in TASK_PERMISSIONS:
        Permission.objects.update_or_create(
            code=permission["code"],
            defaults={
                "name": permission["name"],
                "description": permission["description"],
            },
        )


def remove_task_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(
        code__in=[permission["code"] for permission in TASK_PERMISSIONS]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0010_merge_file_permissions"),
    ]

    operations = [
        migrations.RunPython(
            seed_task_permissions,
            remove_task_permissions,
        ),
    ]
