from datetime import date, datetime
from decimal import Decimal

from django.db import migrations
from django.utils import timezone


SEED_TAG = "seed-project-3"

FINANCIAL_ENTRIES = [
    ("2025-01-08", "expense", "850.00", "Materiaux", "Carrelage salle de bain"),
    ("2025-01-22", "expense", "420.50", "Transport", "Livraison chantier"),
    ("2025-02-05", "expense", "3200.00", "Main d'oeuvre", "Plomberie etape 1"),
    ("2025-02-18", "refund", "120.00", "Transport", "Remboursement trop-percu livraison"),
    ("2025-03-02", "expense", "980.00", "Materiaux", "Peinture et enduit"),
    ("2025-03-15", "expense", "1450.00", "Equipement", "Location echafaudage"),
    ("2025-04-01", "expense", "2100.00", "Main d'oeuvre", "Electricite tableaux"),
    ("2025-04-20", "expense", "760.00", "Administratif", "Assurance chantier"),
    ("2025-05-10", "expense", "540.00", "Materiaux", "Menuiserie interieure"),
    ("2025-05-28", "refund", "85.00", "Materiaux", "Retour surplus peinture"),
    ("2025-06-05", "expense", "1890.00", "Main d'oeuvre", "Finitions peinture"),
]

TASKS = [
    ("Valider plans RDC", "Relecture avec le maitre d'oeuvre", "in_progress", "high", "2025-06-20"),
    ("Commander carrelage", "Valider teintes et quantites", "todo", "normal", "2025-06-25"),
    ("Relancer sous-traitant plomberie", "Point avancement semaine prochaine", "todo", "high", "2025-06-18"),
    ("Archiver factures Q1", "Ranger dans Administration > Factures", "done", "low", "2025-04-30"),
]

TIME_ENTRIES = [
    ("2025-06-03", 240, "45.00", "Reunion coordination chantier"),
    ("2025-06-05", 180, "45.00", "Controle plans etage"),
    ("2025-06-09", 300, "55.00", "Suivi plomberie"),
    ("2025-06-12", 120, "45.00", "Classement documents"),
]


def seed_project_3_demo_data(apps, schema_editor):
    Project = apps.get_model("api", "Project")
    Folder = apps.get_model("api", "Folder")
    Document = apps.get_model("api", "Document")
    Task = apps.get_model("api", "Task")
    TimeEntry = apps.get_model("api", "TimeEntry")
    FinancialEntry = apps.get_model("api", "FinancialEntry")

    if not Project.objects.filter(pk=3).exists():
        return

    project = Project.objects.get(pk=3)
    owner_id = project.owner_id

    administration = Folder.objects.filter(project_id=3, name="Administration", parent_folder__isnull=True).first()
    factures_folder = (
        Folder.objects.filter(project_id=3, name="Factures", parent_folder=administration).first()
        if administration
        else None
    )
    facture_doc = (
        Document.objects.filter(project_id=3, name="Facture mars").first()
        if factures_folder
        else None
    )

    def aware_datetime(value: str) -> datetime:
        return timezone.make_aware(datetime.fromisoformat(value))

    for title, description, status, priority, due_date in TASKS:
        task = Task.objects.create(
            project=project,
            created_by_id=owner_id,
            title=title,
            description=description,
            status=status,
            priority=priority,
            due_date=date.fromisoformat(due_date),
        )
        Task.objects.filter(pk=task.pk).update(
            created_at=aware_datetime(f"{due_date}T09:00:00"),
        )

    first_task = Task.objects.filter(project_id=3, title="Valider plans RDC").first()

    for day, duration, rate, description in TIME_ENTRIES:
        entry = TimeEntry.objects.create(
            project=project,
            task=first_task,
            user_id=owner_id,
            duration_minutes=duration,
            hourly_rate=Decimal(rate),
            description=description,
        )
        TimeEntry.objects.filter(pk=entry.pk).update(
            created_at=aware_datetime(f"{day}T14:00:00"),
        )

    for day, entry_type, amount, category, description in FINANCIAL_ENTRIES:
        entry = FinancialEntry.objects.create(
            project=project,
            folder=factures_folder,
            document=facture_doc,
            created_by_id=owner_id,
            amount=Decimal(amount),
            type=entry_type,
            category=category,
            description=f"[{SEED_TAG}] {description}",
        )
        FinancialEntry.objects.filter(pk=entry.pk).update(
            created_at=aware_datetime(f"{day}T10:30:00"),
        )


def remove_project_3_demo_data(apps, schema_editor):
    Project = apps.get_model("api", "Project")
    Task = apps.get_model("api", "Task")
    TimeEntry = apps.get_model("api", "TimeEntry")
    FinancialEntry = apps.get_model("api", "FinancialEntry")

    if not Project.objects.filter(pk=3).exists():
        return

    FinancialEntry.objects.filter(project_id=3, description__startswith=f"[{SEED_TAG}]").delete()
    TimeEntry.objects.filter(
        project_id=3,
        description__in=[item[3] for item in TIME_ENTRIES],
    ).delete()
    Task.objects.filter(
        project_id=3,
        title__in=[item[0] for item in TASKS],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0025_seed_project_3_demo_files"),
    ]

    operations = [
        migrations.RunPython(
            seed_project_3_demo_data,
            remove_project_3_demo_data,
        ),
    ]
