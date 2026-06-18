from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0035_migrate_document_fk_to_m2m"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="financialentry",
            name="document",
        ),
        migrations.RemoveField(
            model_name="expenserequest",
            name="document",
        ),
    ]
