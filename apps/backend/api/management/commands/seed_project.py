"""
Management command : seed_project --project-id <id>
Génère une grande quantité de données réalistes pour tester la pagination.
"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import (
    ExpenseRequest,
    FinancialEntry,
    Folder,
    Task,
    TimeEntry,
    Project,
)

# ── données métier réalistes ────────────────────────────────────────────────

FOLDER_NAMES = [
    ("Design", None),
    ("Développement", None),
    ("Marketing", None),
    ("RH", None),
    ("Finance", None),
    ("Infrastructure", None),
    ("Communication", None),
    ("Support", None),
    ("Maquettes", "Design"),
    ("Prototype", "Design"),
    ("Backend", "Développement"),
    ("Frontend", "Développement"),
    ("Mobile", "Développement"),
    ("Campagnes", "Marketing"),
    ("Réseaux sociaux", "Marketing"),
    ("Onboarding", "RH"),
    ("Formation", "RH"),
    ("Factures", "Finance"),
    ("Contrats", "Finance"),
    ("Serveurs", "Infrastructure"),
    ("CI/CD", "Infrastructure"),
]

TASK_TEMPLATES = [
    ("Implémenter l'authentification OAuth", "in_progress", "high"),
    ("Migrer la base de données vers PostgreSQL", "todo", "high"),
    ("Créer les tests unitaires pour l'API", "todo", "normal"),
    ("Optimiser les requêtes SQL lentes", "todo", "high"),
    ("Mettre en place le monitoring Sentry", "done", "normal"),
    ("Rédiger la documentation API", "in_progress", "normal"),
    ("Intégrer Stripe pour les paiements", "todo", "high"),
    ("Refactoriser le module d'authentification", "todo", "normal"),
    ("Corriger le bug #142 sur le tableau de bord", "done", "high"),
    ("Ajouter la pagination côté frontend", "done", "normal"),
    ("Mettre à jour les dépendances NPM", "done", "low"),
    ("Configurer le pipeline CI/CD GitHub Actions", "in_progress", "high"),
    ("Conception de la charte graphique v2", "done", "normal"),
    ("Maquettes UI pour le dashboard", "in_progress", "high"),
    ("Audit d'accessibilité RGAA", "todo", "normal"),
    ("Optimiser les images pour le web", "done", "low"),
    ("Créer les templates d'emails transactionnels", "todo", "normal"),
    ("Déploiement sur AWS ECS", "in_progress", "high"),
    ("Rédiger le cahier des charges v2", "done", "normal"),
    ("Analyse concurrentielle Q1", "done", "low"),
    ("Préparer la présentation investisseurs", "in_progress", "high"),
    ("Audit SEO du site vitrine", "todo", "normal"),
    ("Intégration API Google Analytics", "done", "normal"),
    ("Plan de communication Q2", "todo", "normal"),
    ("Recrutement développeur senior", "in_progress", "high"),
    ("Entretiens techniques candidats", "todo", "normal"),
    ("Mise en place du télétravail", "done", "low"),
    ("Plan de formation équipe tech", "todo", "normal"),
    ("Négociation contrat fournisseur AWS", "in_progress", "high"),
    ("Clôture comptable T1", "done", "normal"),
    ("Suivi budget marketing", "in_progress", "normal"),
    ("Mise à jour politique de confidentialité RGPD", "todo", "high"),
    ("Backup automatique de la base de données", "done", "high"),
    ("Mise en cache Redis", "in_progress", "normal"),
    ("Revue de code feature/auth", "done", "normal"),
    ("Tests de charge avec k6", "todo", "high"),
    ("Mise en place du CDN CloudFront", "done", "normal"),
    ("Intégration webhook Stripe", "in_progress", "normal"),
    ("Correction fuite mémoire Node.js", "done", "high"),
    ("Implémentation WebSocket temps réel", "todo", "high"),
    ("Migration vers TypeScript strict", "in_progress", "normal"),
    ("Ajout dark mode", "todo", "low"),
    ("Refactorisation composants React", "in_progress", "normal"),
    ("Tests E2E avec Playwright", "todo", "normal"),
    ("Configurer ESLint et Prettier", "done", "low"),
    ("Internationalisation (i18n)", "todo", "normal"),
    ("Feature flags avec PostHog", "todo", "low"),
    ("Revue architecture microservices", "in_progress", "high"),
    ("Sécurité : audit des dépendances", "done", "high"),
    ("Mise en place du rate limiting", "done", "normal"),
    ("API REST documentation OpenAPI", "in_progress", "normal"),
    ("Réduction du bundle JS", "todo", "normal"),
    ("Amélioration temps de chargement initial", "in_progress", "high"),
    ("Support navigateurs anciens", "todo", "low"),
    ("Intégration Slack notifications", "done", "normal"),
    ("Tableau de bord analytics interne", "in_progress", "normal"),
    ("Export données CSV", "done", "normal"),
    ("Import données via CSV", "todo", "normal"),
    ("Gestion des rôles et permissions", "done", "high"),
    ("Notifications en temps réel", "in_progress", "high"),
    ("Mise à jour changelog", "done", "low"),
    ("Revue de code mensuelle", "done", "low"),
    ("Sprint planning Q2", "done", "normal"),
    ("Rétrospective sprint 8", "done", "low"),
    ("Documentation onboarding dev", "in_progress", "normal"),
    ("Chiffrement des données sensibles", "todo", "high"),
    ("Implémentation 2FA", "in_progress", "high"),
    ("Politique de rotation des secrets", "todo", "high"),
    ("Nettoyage données orphelines", "done", "low"),
    ("Optimisation cold start Lambda", "todo", "normal"),
]

FINANCIAL_CATEGORIES = [
    "Hébergement cloud",
    "Licences logiciels",
    "Matériel informatique",
    "Formation",
    "Prestation externe",
    "Marketing digital",
    "Design graphique",
    "Déplacements",
    "Restauration",
    "Fournitures bureau",
    "Abonnements SaaS",
    "Maintenance serveur",
    "Consulting",
    "Publicité",
    "Événement client",
    "Télécommunications",
    "Assurance",
    "Sous-traitance",
]

FINANCIAL_DESCRIPTIONS = [
    "Facture mensuelle",
    "Renouvellement annuel",
    "Paiement prestataire",
    "Remboursement note de frais",
    "Achat exceptionnel",
    "Abonnement trimestriel",
    "Règlement fournisseur",
    "Avance sur projet",
    "Compensation client",
    "Réajustement budgétaire",
    "Achat urgent",
    "Abonnement mensuel",
    "Paiement partiel",
    "Solde restant",
    "Crédit note reçue",
]

TIME_DESCRIPTIONS = [
    "Développement feature principale",
    "Revue de code",
    "Réunion d'équipe",
    "Debug et correction",
    "Documentation technique",
    "Tests et validation",
    "Déploiement en production",
    "Analyse des besoins",
    "Conception architecture",
    "Support client",
    "Formation interne",
    "Optimisation performances",
    "Intégration continue",
    "Présentation client",
    "Planification sprint",
    "Retrospective",
    "Pair programming",
    "Audit sécurité",
    "Migration données",
    "Mise en place monitoring",
]

REQUEST_TEMPLATES = [
    ("Conférence React Paris 2025", "Événement", 490),
    ("Abonnement Figma annuel", "Licences logiciels", 180),
    ("MacBook Pro M4 développeur", "Matériel informatique", 2299),
    ("Formation AWS Solutions Architect", "Formation", 1200),
    ("Plugin JetBrains annuel", "Licences logiciels", 249),
    ("Déplacement réunion Lyon", "Déplacements", 180),
    ("Déjeuner client important", "Restauration", 145),
    ("Abonnement Notion Team", "Abonnements SaaS", 160),
    ("Ecran Dell 27\" 4K", "Matériel informatique", 549),
    ("Conférence DevoXX 2025", "Événement", 320),
    ("Abonnement GitHub Enterprise", "Licences logiciels", 210),
    ("Formation sécurité OWASP", "Formation", 800),
    ("SSD externe 2To", "Matériel informatique", 99),
    ("Clavier mécanique ergonomique", "Matériel informatique", 189),
    ("Abonnement Slack Pro", "Abonnements SaaS", 87),
    ("Hébergement domaine 3 ans", "Hébergement cloud", 60),
    ("Cours Udemy développement", "Formation", 15),
    ("Casque audio professionnel", "Matériel informatique", 299),
    ("Déplacement client Paris", "Déplacements", 240),
    ("Abonnement Datadog", "Abonnements SaaS", 420),
    ("Livre Clean Architecture", "Formation", 42),
    ("Webcam 4K pour télétravail", "Matériel informatique", 149),
    ("Repas équipe fin sprint", "Restauration", 320),
    ("Licence Adobe XD", "Licences logiciels", 119),
    ("Abonnement Linear annuel", "Abonnements SaaS", 288),
    ("Micro USB-C conférence", "Matériel informatique", 79),
    ("Formation TypeScript avancé", "Formation", 350),
    ("Déplacement salon tech Berlin", "Déplacements", 890),
    ("Serveur NAS backup", "Infrastructure", 650),
    ("Câbles et accessoires réseau", "Matériel informatique", 85),
]


class Command(BaseCommand):
    help = "Seed un projet avec beaucoup de données de test"

    def add_arguments(self, parser):
        parser.add_argument("--project-id", type=int, default=3)
        parser.add_argument("--tasks", type=int, default=120)
        parser.add_argument("--finance", type=int, default=150)
        parser.add_argument("--time", type=int, default=80)
        parser.add_argument("--requests", type=int, default=60)

    def handle(self, *args, **options):
        project_id = options["project_id"]
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            self.stderr.write(f"Projet {project_id} introuvable.")
            return

        owner = project.owner
        self.stdout.write(f"Seed projet #{project_id} '{project.name}' (owner: {owner.username})")

        folders = self._get_or_create_folders(project, owner)
        self.stdout.write(f"  Dossiers disponibles : {len(folders)}")

        tasks = self._create_tasks(project, owner, folders, options["tasks"])
        self.stdout.write(f"  OK {len(tasks)} taches creees")

        time_entries = self._create_time_entries(project, owner, folders, tasks, options["time"])
        self.stdout.write(f"  OK {len(time_entries)} entrees de temps creees")

        self._create_financial_entries(project, owner, folders, tasks, options["finance"])
        self.stdout.write(f"  OK {options['finance']} entrees financieres creees")

        self._create_expense_requests(project, owner, folders, tasks, options["requests"])
        self.stdout.write(f"  OK {options['requests']} demandes de remboursement creees")

        self.stdout.write(self.style.SUCCESS("Seed termine."))

    # ── dossiers ─────────────────────────────────────────────────────────────

    def _get_or_create_folders(self, project, owner):
        existing = {f.name: f for f in Folder.objects.filter(project=project)}
        roots = {}

        for name, parent_name in FOLDER_NAMES:
            if name in existing:
                folder = existing[name]
            else:
                parent = roots.get(parent_name) if parent_name else None
                folder = Folder.objects.create(
                    project=project,
                    name=name,
                    created_by=owner,
                    parent_folder=parent,
                    color=random.choice(["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"]),
                )
                existing[name] = folder

            if parent_name is None:
                roots[name] = folder

        return list(existing.values())

    # ── tâches ───────────────────────────────────────────────────────────────

    def _create_tasks(self, project, owner, folders, count):
        today = date.today()
        tasks = []
        templates = TASK_TEMPLATES * (count // len(TASK_TEMPLATES) + 1)

        for i in range(count):
            title, status, priority = templates[i]
            # Rend les titres uniques
            suffix = f" #{i+1}" if i >= len(TASK_TEMPLATES) else ""
            start_offset = random.randint(-90, 30)
            duration = random.randint(1, 30)
            start_date = today + timedelta(days=start_offset)
            due_date = start_date + timedelta(days=duration)

            task = Task(
                project=project,
                folder=random.choice(folders) if random.random() > 0.3 else None,
                created_by=owner,
                title=title + suffix,
                description=f"Description détaillée de la tâche : {title.lower()}{suffix}. "
                            f"Cette tâche fait partie du projet {project.name} et nécessite "
                            f"une attention particulière pour être livrée dans les délais.",
                status=status,
                priority=priority,
                start_date=start_date if random.random() > 0.2 else None,
                due_date=due_date if random.random() > 0.2 else None,
            )
            tasks.append(task)

        created = Task.objects.bulk_create(tasks)
        # Assigner owner à quelques tâches
        for task in random.sample(created, min(len(created) // 3, len(created))):
            task.assigned_to.add(owner)
        return created

    # ── entrées de temps ─────────────────────────────────────────────────────

    def _create_time_entries(self, project, owner, folders, tasks, count):
        entries = []
        today = date.today()
        rates = [0, 50, 75, 100, 120, 150]

        for _ in range(count):
            use_task = random.random() > 0.4 and tasks
            use_folder = not use_task and random.random() > 0.3 and folders

            offset = random.randint(-180, 0)
            created_at = timezone.now() + timedelta(days=offset)

            entries.append(TimeEntry(
                project=project,
                task=random.choice(tasks) if use_task else None,
                folder=random.choice(folders) if use_folder else None,
                user=owner,
                duration_minutes=random.choice([30, 45, 60, 90, 120, 180, 240, 300, 360, 480]),
                hourly_rate=Decimal(str(random.choice(rates))),
                description=random.choice(TIME_DESCRIPTIONS),
                created_at=created_at,
            ))

        # bulk_create ne gère pas auto_now_add, on override created_at après
        created = TimeEntry.objects.bulk_create(entries)
        for te, e in zip(created, entries):
            TimeEntry.objects.filter(pk=te.pk).update(created_at=e.created_at)
        return created

    # ── entrées financières ───────────────────────────────────────────────────

    def _create_financial_entries(self, project, owner, folders, tasks, count):
        entries = []
        for _ in range(count):
            entry_type = random.choices(
                [FinancialEntry.FinancialType.EXPENSE, FinancialEntry.FinancialType.REFUND],
                weights=[80, 20],
            )[0]

            use_folder = random.random() > 0.5 and folders
            use_task = not use_folder and random.random() > 0.5 and tasks

            amount = Decimal(str(round(random.uniform(5, 5000), 2)))
            offset = random.randint(-365, 0)
            created_at = timezone.now() + timedelta(days=offset)
            entry_date = (timezone.now() + timedelta(days=offset)).date()

            entries.append(FinancialEntry(
                project=project,
                folder=random.choice(folders) if use_folder else None,
                task=random.choice(tasks) if use_task else None,
                created_by=owner,
                type=entry_type,
                amount=amount,
                category=random.choice(FINANCIAL_CATEGORIES),
                description=random.choice(FINANCIAL_DESCRIPTIONS),
                date=entry_date,
                created_at=created_at,
            ))

        created = FinancialEntry.objects.bulk_create(entries)
        for fe, e in zip(created, entries):
            FinancialEntry.objects.filter(pk=fe.pk).update(created_at=e.created_at)

    # ── demandes de remboursement ─────────────────────────────────────────────

    def _create_expense_requests(self, project, owner, folders, tasks, count):
        statuses = ["pending", "approved", "rejected"]
        weights = [50, 35, 15]
        templates = REQUEST_TEMPLATES * (count // len(REQUEST_TEMPLATES) + 1)

        requests = []
        for i in range(count):
            title, category, base_amount = templates[i]
            suffix = f" #{i+1}" if i >= len(REQUEST_TEMPLATES) else ""
            amount = Decimal(str(round(base_amount * random.uniform(0.8, 1.2), 2)))
            status = random.choices(statuses, weights=weights)[0]
            use_folder = random.random() > 0.5 and folders
            use_task = not use_folder and random.random() > 0.5 and tasks
            offset = random.randint(-180, 0)
            created_at = timezone.now() + timedelta(days=offset)

            requests.append(ExpenseRequest(
                project=project,
                title=title + suffix,
                amount=amount,
                category=category,
                description=f"Demande de remboursement pour : {title.lower()}{suffix}. "
                            f"Justificatif disponible sur demande.",
                folder=random.choice(folders) if use_folder else None,
                task=random.choice(tasks) if use_task else None,
                status=status,
                requested_by=owner,
                approved_by=owner if status == "approved" else None,
                approved_at=timezone.now() + timedelta(days=offset + 5) if status == "approved" else None,
                created_at=created_at,
            ))

        created = ExpenseRequest.objects.bulk_create(requests)
        for req, r in zip(created, requests):
            ExpenseRequest.objects.filter(pk=req.pk).update(
                created_at=r.created_at,
                approved_at=r.approved_at,
            )
