from django.db import migrations


def seed_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.update_or_create(
        code="time_entry.view_others_detail",
        defaults={
            "name": "permissions.time_entry.view_others_detail.name",
            "description": "permissions.time_entry.view_others_detail.description",
        },
    )


def remove_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(code__in=["time_entry.view_others_detail"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0056_projectcalendarsubscription"),
    ]

    operations = [
        migrations.RunPython(seed_permissions, remove_permissions),
    ]
