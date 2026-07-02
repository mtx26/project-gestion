from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0053_backfill_timeentry_start_date"),
    ]

    operations = [
        migrations.AlterField(
            model_name="timeentry",
            name="start_date",
            field=models.DateTimeField(),
        ),
    ]
