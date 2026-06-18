from django.db import migrations


def remove_project_delete_permission(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(code="project.delete").delete()


def restore_project_delete_permission(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.update_or_create(
        code="project.delete",
        defaults={
            "name": "permissions.project.delete.name",
            "description": "permissions.project.delete.description",
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0022_financialentry_time_entry"),
    ]

    operations = [
        migrations.RunPython(
            remove_project_delete_permission,
            restore_project_delete_permission,
        ),
    ]
