from django.db import migrations
from django.db.models import OuterRef, Subquery


def backfill_title_from_task(apps, schema_editor):
    # Le manager historique n'est pas filtre par deleted_at : les entrees supprimees
    # sont couvertes elles aussi, pour qu'une restauration ne ramene pas une entree
    # sans titre. Seules celles rattachees a une tache peuvent etre remplies — les
    # autres n'ont aucune source de titre et restent vides.
    #
    # `Subquery` et pas `F("task__title")` : un `update()` refuse les references de
    # champs joints.
    TimeEntry = apps.get_model("api", "TimeEntry")
    Task = apps.get_model("api", "Task")
    TimeEntry.objects.filter(task__isnull=False, title="").update(
        title=Subquery(Task.objects.filter(pk=OuterRef("task_id")).values("title")[:1]),
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0058_timeentry_title"),
    ]

    operations = [
        migrations.RunPython(backfill_title_from_task, noop),
    ]
