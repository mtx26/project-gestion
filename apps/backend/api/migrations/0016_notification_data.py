from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0015_use_member_edit_permission"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="data",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RemoveField(
            model_name="emaildelivery",
            name="notification",
        ),
    ]
