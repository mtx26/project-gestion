import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0017_timeentry_hourly_rate"),
    ]

    operations = [
        migrations.AddField(
            model_name="financialentry",
            name="document",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="api.document",
            ),
        ),
    ]
