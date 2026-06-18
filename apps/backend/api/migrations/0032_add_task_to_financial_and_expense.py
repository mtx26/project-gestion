import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0031_seed_expense_request_permissions"),
    ]

    operations = [
        migrations.AddField(
            model_name="financialentry",
            name="task",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="financial_entries",
                to="api.task",
            ),
        ),
        migrations.AddField(
            model_name="expenserequest",
            name="task",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="expense_requests",
                to="api.task",
            ),
        ),
    ]
