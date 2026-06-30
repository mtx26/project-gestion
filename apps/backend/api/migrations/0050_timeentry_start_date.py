from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0049_task_start_end_date_to_datetime"),
    ]

    operations = [
        migrations.AddField(
            model_name="timeentry",
            name="start_date",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
