from django.db import migrations


PERMISSIONS = [
    "expense_request.view",
    "expense_request.edit",
    "expense_request.delete",
    "expense_request.approve",
]


def seed_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    for code in PERMISSIONS:
        Permission.objects.update_or_create(
            code=code,
            defaults={
                "name": f"permissions.{code}.name",
                "description": f"permissions.{code}.description",
            },
        )


def remove_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(code__in=PERMISSIONS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0030_add_expense_request"),
    ]

    operations = [
        migrations.RunPython(seed_permissions, remove_permissions),
    ]
