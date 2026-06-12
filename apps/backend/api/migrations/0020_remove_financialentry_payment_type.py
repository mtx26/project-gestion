from django.db import migrations, models


def convert_removed_financial_types(apps, schema_editor):
    FinancialEntry = apps.get_model("api", "FinancialEntry")
    FinancialEntry.objects.filter(type__in=["invoice", "payment"]).update(type="expense")


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0019_remove_financialentry_invoice_type"),
    ]

    operations = [
        migrations.RunPython(
            convert_removed_financial_types,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="financialentry",
            name="type",
            field=models.CharField(
                choices=[
                    ("expense", "financial.types.expense"),
                    ("refund", "financial.types.refund"),
                ],
                max_length=50,
            ),
        ),
    ]
