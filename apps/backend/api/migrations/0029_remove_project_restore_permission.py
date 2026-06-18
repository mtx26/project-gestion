from django.db import migrations


def remove_project_restore_permission(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(code="project.restore").delete()


def restore_project_restore_permission(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.update_or_create(
        code="project.restore",
        defaults={
            "name": "permissions.project.restore.name",
            "description": "permissions.project.restore.description",
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0028_backfill_role_permission_dependencies"),
    ]

    operations = [
        migrations.RunPython(
            remove_project_restore_permission,
            restore_project_restore_permission,
        ),
    ]
