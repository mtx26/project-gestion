from django.db import migrations


ACTIVE_PERMISSIONS = [
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
        "code": "role.view",
        "name": "permissions.role.view.name",
        "description": "permissions.role.view.description",
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
        "code": "role.restore",
        "name": "permissions.role.restore.name",
        "description": "permissions.role.restore.description",
    },
    {
        "code": "member.view",
        "name": "permissions.member.view.name",
        "description": "permissions.member.view.description",
    },
    {
        "code": "member.delete",
        "name": "permissions.member.delete.name",
        "description": "permissions.member.delete.description",
    },
    {
        "code": "folder.view",
        "name": "permissions.folder.view.name",
        "description": "permissions.folder.view.description",
    },
    {
        "code": "folder.edit",
        "name": "permissions.folder.edit.name",
        "description": "permissions.folder.edit.description",
    },
    {
        "code": "folder.delete",
        "name": "permissions.folder.delete.name",
        "description": "permissions.folder.delete.description",
    },
    {
        "code": "folder.restore",
        "name": "permissions.folder.restore.name",
        "description": "permissions.folder.restore.description",
    },
    {
        "code": "document.view",
        "name": "permissions.document.view.name",
        "description": "permissions.document.view.description",
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
        "code": "document.restore",
        "name": "permissions.document.restore.name",
        "description": "permissions.document.restore.description",
    },
]


OBSOLETE_PERMISSION_CODES = [
    "project.create",
    "project.remove",
    "project.manage_roles",
    "role.create",
    "member.invite",
    "member.remove",
    "member.edit",
    "folder.create",
    "folder.view_trash",
    "document.create",
    "document.download",
    "document.view_trash",
    "task.create",
    "task.edit",
    "task.delete",
]


def normalize_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")

    Permission.objects.filter(code__in=OBSOLETE_PERMISSION_CODES).delete()

    for permission in ACTIVE_PERMISSIONS:
        Permission.objects.update_or_create(
            code=permission["code"],
            defaults={
                "name": permission["name"],
                "description": permission["description"],
            },
        )


def restore_previous_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")

    Permission.objects.filter(
        code__in=[
            "role.restore",
            "member.delete",
            "folder.edit",
            "folder.restore",
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_seed_document_permissions"),
    ]

    operations = [
        migrations.RunPython(
            normalize_permissions,
            restore_previous_permissions,
        ),
    ]
