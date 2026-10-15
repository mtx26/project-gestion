"""
Management command : send_test_push --email <email> [--title ...] [--body ...] [--in-app]

Envoie une notification push de test aux appareils enregistres d'un utilisateur.
Passe par le meme service que l'application (`services/push.py`), donc un envoi qui
marche ici marche aussi pour une invitation.
"""
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from api.models import DeviceToken
from api.services.notifications import notify
from api.services.push import send_push_to_user


class Command(BaseCommand):
    help = "Envoie une notification push de test a un utilisateur."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Email du compte destinataire.")
        parser.add_argument("--title", default="Notification de test")
        parser.add_argument("--body", default="Si tu vois ceci, les notifications push fonctionnent.")
        parser.add_argument(
            "--in-app",
            action="store_true",
            help="Cree aussi la notification en base (teste toute la chaine, comme une invitation).",
        )

    def handle(self, *args, **options):
        user = User.objects.filter(email__iexact=options["email"]).first()
        if user is None:
            raise CommandError(f"Aucun compte avec l'email {options['email']}.")

        tokens = list(DeviceToken.objects.filter(user=user).values_list("token", flat=True))
        if not tokens:
            raise CommandError(
                "Aucun appareil enregistre pour ce compte. Ouvre l'application (build de "
                "developpement ou de production, pas Expo Go sur Android), connecte-toi, "
                "et accepte la demande de notifications."
            )

        self.stdout.write(f"{len(tokens)} appareil(s) : {', '.join(t[:28] + '...' for t in tokens)}")

        if options["in_app"]:
            notify(
                user=user,
                type="test",
                title=options["title"],
                message=options["body"],
            )
            self.stdout.write(self.style.SUCCESS("Notification creee en base + push envoye."))
            return

        send_push_to_user(user=user, title=options["title"], body=options["body"], data={"type": "test"})
        self.stdout.write(self.style.SUCCESS("Push envoye."))
        self.stdout.write(
            "Rien recu ? Le service Expo repond de facon asynchrone : un jeton invalide est "
            "purge automatiquement au prochain envoi (voir services/push.py)."
        )
