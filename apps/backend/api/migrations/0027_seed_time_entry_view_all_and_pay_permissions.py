from django.db import migrations


PERMISSIONS = [
    "time_entry.view_all",
    "time_entry.pay",
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
        ("api", "0026_seed_project_3_demo_data"),
    ]

    operations = [
        migrations.RunPython(
            seed_permissions,
            remove_permissions,
        ),
    ]
