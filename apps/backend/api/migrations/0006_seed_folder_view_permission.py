from django.db import migrations


PERMISSIONS = [
    {
        "code": "project.create",
        "name": "permissions.project.create.name",
        "description": "permissions.project.create.description",
    },
    {
        "code": "folder.view",
        "name": "permissions.folder.view.name",
        "description": "permissions.folder.view.description",
    },
]


def seed_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")

    for permission in PERMISSIONS:
        Permission.objects.update_or_create(
            code=permission["code"],
            defaults={
                "name": permission["name"],
                "description": permission["description"],
            },
        )


def remove_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(
        code__in=[permission["code"] for permission in PERMISSIONS]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0005_seed_view_remove_project_permissions"),
    ]

    operations = [
        migrations.RunPython(
            seed_permissions,
            remove_permissions,
        ),
    ]
