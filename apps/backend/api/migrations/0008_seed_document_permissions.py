from django.db import migrations


PERMISSIONS = [
    {
        "code": "document.view",
        "name": "permissions.document.view.name",
        "description": "permissions.document.view.description",
    },
    {
        "code": "document.create",
        "name": "permissions.document.create.name",
        "description": "permissions.document.create.description",
    },
    {
        "code": "document.edit",
        "name": "permissions.document.edit.name",
        "description": "permissions.document.edit.description",
    },
    {
        "code": "document.delete",
        "name": "permissions.document.delete.name",
        "description": "permissions.document.delete.description",
    },
    {
        "code": "document.download",
        "name": "permissions.document.download.name",
        "description": "permissions.document.download.description",
    },
    {
        "code": "document.view_trash",
        "name": "permissions.document.view_trash.name",
        "description": "permissions.document.view_trash.description",
    },
    {
        "code": "document.restore",
        "name": "permissions.document.restore.name",
        "description": "permissions.document.restore.description",
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
        ("api", "0007_remove_project_view_permission"),
    ]

    operations = [
        migrations.RunPython(
            seed_permissions,
            remove_permissions,
        ),
    ]
