from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0048_rename_task_due_date_to_end_date"),
    ]

    operations = [
        migrations.AlterField(
            model_name="task",
            name="start_date",
            field=models.DateTimeField(blank=True, db_index=False, null=True),
        ),
        migrations.AlterField(
            model_name="task",
            name="end_date",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
