from django.db import migrations


def clear_auto_payment_descriptions(apps, schema_editor):
    FinancialEntry = apps.get_model("api", "FinancialEntry")
    FinancialEntry.objects.filter(
        time_entry__isnull=False,
        description__startswith="Paiement temps #",
    ).update(description=None)


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0036_remove_document_fk"),
    ]

    operations = [
        migrations.RunPython(clear_auto_payment_descriptions, migrations.RunPython.noop),
    ]
