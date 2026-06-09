from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_alter_financialentry_type"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="project",
            name="unique_project_name_per_owner",
        ),
        migrations.RemoveConstraint(
            model_name="folder",
            name="unique_folder_name_per_parent",
        ),
        migrations.RemoveConstraint(
            model_name="document",
            name="unique_document_name_per_folder",
        ),
        migrations.RemoveConstraint(
            model_name="role",
            name="unique_role_name_per_project",
        ),
        migrations.RemoveConstraint(
            model_name="projectmember",
            name="unique_project_member",
        ),
        migrations.RemoveConstraint(
            model_name="rolepermission",
            name="unique_role_permission",
        ),
        migrations.AddConstraint(
            model_name="project",
            constraint=models.UniqueConstraint(
                fields=("owner", "name"),
                condition=models.Q(deleted_at__isnull=True),
                name="unique_active_project_name_per_owner",
            ),
        ),
        migrations.AddConstraint(
            model_name="role",
            constraint=models.UniqueConstraint(
                fields=("project", "name"),
                condition=models.Q(deleted_at__isnull=True),
                name="unique_active_role_name_per_project",
            ),
        ),
        migrations.AddConstraint(
            model_name="projectmember",
            constraint=models.UniqueConstraint(
                fields=("project", "user"),
                condition=models.Q(deleted_at__isnull=True),
                name="unique_active_project_member",
            ),
        ),
        migrations.AddConstraint(
            model_name="rolepermission",
            constraint=models.UniqueConstraint(
                fields=("role", "permission"),
                condition=models.Q(deleted_at__isnull=True),
                name="unique_active_role_permission",
            ),
        ),
        migrations.AddConstraint(
            model_name="folder",
            constraint=models.UniqueConstraint(
                fields=("project", "parent_folder", "name"),
                condition=models.Q(
                    deleted_at__isnull=True,
                    parent_folder__isnull=False,
                ),
                name="unique_active_folder_name_per_parent",
            ),
        ),
        migrations.AddConstraint(
            model_name="folder",
            constraint=models.UniqueConstraint(
                fields=("project", "name"),
                condition=models.Q(
                    deleted_at__isnull=True,
                    parent_folder__isnull=True,
                ),
                name="unique_active_root_folder_name",
            ),
        ),
        migrations.AddConstraint(
            model_name="document",
            constraint=models.UniqueConstraint(
                fields=("project", "folder", "name"),
                condition=models.Q(
                    deleted_at__isnull=True,
                    folder__isnull=False,
                ),
                name="unique_active_document_name_per_folder",
            ),
        ),
        migrations.AddConstraint(
            model_name="document",
            constraint=models.UniqueConstraint(
                fields=("project", "name"),
                condition=models.Q(
                    deleted_at__isnull=True,
                    folder__isnull=True,
                ),
                name="unique_active_root_document_name",
            ),
        ),
    ]
