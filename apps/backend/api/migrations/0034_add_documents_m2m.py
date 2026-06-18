from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0033_add_created_by_to_folder"),
    ]

    operations = [
        migrations.AddField(
            model_name="financialentry",
            name="documents",
            field=models.ManyToManyField(
                blank=True,
                related_name="financial_entries_docs",
                to="api.document",
            ),
        ),
        migrations.AddField(
            model_name="expenserequest",
            name="documents",
            field=models.ManyToManyField(
                blank=True,
                related_name="expense_requests_docs",
                to="api.document",
            ),
        ),
    ]
