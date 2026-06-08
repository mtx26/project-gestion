from django.db import migrations


PROJECT_PERMISSIONS = [
    {
        "code": "project.edit",
        "name": "permissions.project.edit.name",
        "description": "permissions.project.edit.description",
    },
    {
        "code": "project.delete",
        "name": "permissions.project.delete.name",
        "description": "permissions.project.delete.description",
    },
    {
        "code": "project.restore",
        "name": "permissions.project.restore.name",
        "description": "permissions.project.restore.description",
    },
    {
        "code": "project.manage_roles",
        "name": "permissions.project.manage_roles.name",
        "description": "permissions.project.manage_roles.description",
    },
]


def seed_project_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")

    for permission in PROJECT_PERMISSIONS:
        Permission.objects.update_or_create(
            code=permission["code"],
            defaults={
                "name": permission["name"],
                "description": permission["description"],
            },
        )


def remove_project_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(
        code__in=[permission["code"] for permission in PROJECT_PERMISSIONS]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            seed_project_permissions,
            remove_project_permissions,
        ),
    ]
