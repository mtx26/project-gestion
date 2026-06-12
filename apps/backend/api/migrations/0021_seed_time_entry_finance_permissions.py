from django.db import migrations


PERMISSIONS = [
    {
        "code": "time_entry.view",
        "name": "permissions.time_entry.view.name",
        "description": "permissions.time_entry.view.description",
    },
    {
        "code": "time_entry.edit",
        "name": "permissions.time_entry.edit.name",
        "description": "permissions.time_entry.edit.description",
    },
    {
        "code": "time_entry.delete",
        "name": "permissions.time_entry.delete.name",
        "description": "permissions.time_entry.delete.description",
    },
    {
        "code": "time_entry.restore",
        "name": "permissions.time_entry.restore.name",
        "description": "permissions.time_entry.restore.description",
    },
    {
        "code": "finance.view",
        "name": "permissions.finance.view.name",
        "description": "permissions.finance.view.description",
    },
    {
        "code": "finance.edit",
        "name": "permissions.finance.edit.name",
        "description": "permissions.finance.edit.description",
    },
    {
        "code": "finance.delete",
        "name": "permissions.finance.delete.name",
        "description": "permissions.finance.delete.description",
    },
    {
        "code": "finance.restore",
        "name": "permissions.finance.restore.name",
        "description": "permissions.finance.restore.description",
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
        ("api", "0020_remove_financialentry_payment_type"),
    ]

    operations = [
        migrations.RunPython(
            seed_permissions,
            remove_permissions,
        ),
    ]
