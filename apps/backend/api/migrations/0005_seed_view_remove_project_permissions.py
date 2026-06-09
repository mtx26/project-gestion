from django.db import migrations


PERMISSIONS = [
    {
        "code": "project.view",
        "name": "permissions.project.view.name",
        "description": "permissions.project.view.description",
    },
    {
        "code": "project.remove",
        "name": "permissions.project.remove.name",
        "description": "permissions.project.remove.description",
    },
    {
        "code": "role.view",
        "name": "permissions.role.view.name",
        "description": "permissions.role.view.description",
    },
    {
        "code": "role.create",
        "name": "permissions.role.create.name",
        "description": "permissions.role.create.description",
    },
    {
        "code": "role.edit",
        "name": "permissions.role.edit.name",
        "description": "permissions.role.edit.description",
    },
    {
        "code": "role.delete",
        "name": "permissions.role.delete.name",
        "description": "permissions.role.delete.description",
    },
    {
        "code": "member.view",
        "name": "permissions.member.view.name",
        "description": "permissions.member.view.description",
    },
    {
        "code": "member.invite",
        "name": "permissions.member.invite.name",
        "description": "permissions.member.invite.description",
    },
    {
        "code": "member.remove",
        "name": "permissions.member.remove.name",
        "description": "permissions.member.remove.description",
    },
    {
        "code": "folder.create",
        "name": "permissions.folder.create.name",
        "description": "permissions.folder.create.description",
    },
    {
        "code": "folder.delete",
        "name": "permissions.folder.delete.name",
        "description": "permissions.folder.delete.description",
    },
    {
        "code": "document.create",
        "name": "permissions.document.create.name",
        "description": "permissions.document.create.description",
    },
    {
        "code": "document.download",
        "name": "permissions.document.download.name",
        "description": "permissions.document.download.description",
    },
    {
        "code": "document.delete",
        "name": "permissions.document.delete.name",
        "description": "permissions.document.delete.description",
    },
    {
        "code": "task.create",
        "name": "permissions.task.create.name",
        "description": "permissions.task.create.description",
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
]


def seed_project_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")

    for permission in PERMISSIONS:
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
        code__in=[permission["code"] for permission in PERMISSIONS]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_active_unique_constraints"),
    ]

    operations = [
        migrations.RunPython(
            seed_project_permissions,
            remove_project_permissions,
        ),
    ]
