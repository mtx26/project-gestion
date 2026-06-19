from django.db import migrations


def seed_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.update_or_create(
        code="expense_request.restore",
        defaults={
            "name": "permissions.expense_request.restore.name",
            "description": "permissions.expense_request.restore.description",
        },
    )


def remove_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(code="expense_request.restore").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0037_clear_auto_payment_descriptions"),
    ]

    operations = [
        migrations.RunPython(seed_permissions, remove_permissions),
    ]
