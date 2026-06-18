from django.db import migrations


def migrate_documents_to_m2m(apps, schema_editor):
    FinancialEntry = apps.get_model("api", "FinancialEntry")
    for entry in FinancialEntry.objects.exclude(document=None):
        if entry.document_id:
            entry.documents.add(entry.document_id)

    ExpenseRequest = apps.get_model("api", "ExpenseRequest")
    for req in ExpenseRequest.objects.exclude(document=None):
        if req.document_id:
            req.documents.add(req.document_id)


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0034_add_documents_m2m"),
    ]

    operations = [
        migrations.RunPython(migrate_documents_to_m2m, migrations.RunPython.noop),
    ]
