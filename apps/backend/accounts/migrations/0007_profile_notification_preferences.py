from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_profile_default_hourly_rate"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="notification_email",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="profile",
            name="notification_push",
            field=models.BooleanField(default=True),
        ),
    ]
