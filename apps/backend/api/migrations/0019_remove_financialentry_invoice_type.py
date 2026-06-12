from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0018_financialentry_document"),
    ]

    operations = [
        migrations.AlterField(
            model_name="financialentry",
            name="type",
            field=models.CharField(
                choices=[
                    ("expense", "financial.types.expense"),
                    ("refund", "financial.types.refund"),
                    ("payment", "financial.types.payment"),
                ],
                max_length=50,
            ),
        ),
    ]
