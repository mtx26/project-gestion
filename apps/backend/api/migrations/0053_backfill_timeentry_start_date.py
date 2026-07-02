from django.db import migrations, models


def backfill_start_date(apps, schema_editor):
    # Le manager historique de la migration n'est pas filtre par deleted_at :
    # toutes les entrees (y compris supprimees) sont couvertes.
    TimeEntry = apps.get_model("api", "TimeEntry")
    TimeEntry.objects.filter(start_date__isnull=True).update(start_date=models.F("created_at"))


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0052_remove_document_unique_active_document_name_per_folder_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_start_date, noop),
    ]
