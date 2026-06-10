from django.db import migrations


def remove_project_view_permission(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(code="project.view").delete()


def restore_project_view_permission(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.update_or_create(
        code="project.view",
        defaults={
            "name": "permissions.project.view.name",
            "description": "permissions.project.view.description",
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_seed_folder_view_permission"),
    ]

    operations = [
        migrations.RunPython(
            remove_project_view_permission,
            restore_project_view_permission,
        ),
    ]
