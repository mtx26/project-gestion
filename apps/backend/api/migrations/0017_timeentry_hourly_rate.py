from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0016_notification_data"),
    ]

    operations = [
        migrations.AddField(
            model_name="timeentry",
            name="hourly_rate",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
