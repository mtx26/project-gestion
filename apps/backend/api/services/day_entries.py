from django.db import transaction

from ..models import Task


def create_day_entry(*, project, actor, title, entries, start_date, end_date, description="", folder=None, priority=None, documents=None):
    """Cree une tache deja terminee et une TimeEntry par personne ayant travaille
    dessus, en une seule transaction (bouton "Nouvelle entree de journee"). Toutes
    les personnes partagent le meme `start_date`/`end_date`, donc la meme duree ;
    seul `hourly_rate` varie par personne.

    La validation "l'utilisateur appartient au projet" est deleguee a
    `TimeEntrySerializer.validate_user` pour chaque entree ; comme tout tourne
    dans la meme transaction, un utilisateur invalide annule aussi la tache
    (et l'assignation) crees juste avant."""
    from ..serializers import TimeEntrySerializer

    duration_minutes = round((end_date - start_date).total_seconds() / 60)

    with transaction.atomic():
        task = Task(
            project=project,
            folder=folder,
            title=title,
            description=description,
            status=Task.Status.DONE,
            start_date=start_date,
            end_date=end_date,
            completed_at=end_date,
            priority=priority or Task.Priority.NORMAL,
            created_by=actor,
        )
        task.full_clean()
        task.save()
        task.assigned_to.set(entry["user"].id for entry in entries)
        if documents:
            task.documents.set(documents)

        time_entries = []
        for entry in entries:
            serializer = TimeEntrySerializer(
                data={
                    "task": task.id,
                    "user": entry["user"].id,
                    "start_date": start_date,
                    "duration_minutes": duration_minutes,
                    "description": description,
                    **({"hourly_rate": entry["hourly_rate"]} if entry.get("hourly_rate") is not None else {}),
                },
                context={"project": project},
            )
            serializer.is_valid(raise_exception=True)
            time_entries.append(serializer.save(project=project))

    return {"task": task, "time_entries": time_entries}
