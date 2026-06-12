import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0021_seed_time_entry_finance_permissions"),
    ]

    operations = [
        migrations.AddField(
            model_name="financialentry",
            name="time_entry",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="financial_entries",
                to="api.timeentry",
            ),
        ),
    ]
