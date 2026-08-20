import logging

import requests
from django.conf import settings

from ..models import DeviceToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
# Limite documentee par Expo : 100 messages par requete.
EXPO_PUSH_BATCH_SIZE = 100
REQUEST_TIMEOUT_SECONDS = 10


def send_push_to_user(*, user, title, body, data=None):
    """Envoie une notification push a tous les appareils enregistres d'un utilisateur.

    Passe par le service Expo Push plutot que par FCM/APNs en direct : c'est une
    simple requete HTTP, et Expo gere les deux plateformes et leurs credentials.

    Ne leve jamais : une notification est un a-cote de l'action metier qui l'a
    declenchee (inviter, payer, approuver...). Un service push injoignable ne doit
    pas faire echouer cette action.
    """
    tokens = list(
        DeviceToken.objects.filter(user=user).values_list("token", flat=True)
    )
    if not tokens:
        return

    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
        }
        for token in tokens
    ]

    for start in range(0, len(messages), EXPO_PUSH_BATCH_SIZE):
        batch = messages[start : start + EXPO_PUSH_BATCH_SIZE]
        try:
            response = requests.post(
                EXPO_PUSH_URL,
                json=batch,
                headers=_build_headers(),
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            _handle_tickets(batch, response.json().get("data", []))
        except requests.RequestException:
            logger.warning("Envoi push Expo impossible pour l'utilisateur %s", user.pk, exc_info=True)
        except ValueError:
            logger.warning("Reponse push Expo illisible pour l'utilisateur %s", user.pk, exc_info=True)


def _build_headers():
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    # Facultatif : active la verification d'expediteur cote Expo (recommande en
    # production, inutile en developpement).
    access_token = getattr(settings, "EXPO_ACCESS_TOKEN", "")
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers


def _handle_tickets(batch, tickets):
    """Purge les jetons qu'Expo declare morts.

    `DeviceNotRegistered` = app desinstallee, notifications coupees, ou jeton
    remplace. Le garder ferait echouer tous les envois suivants pour cet
    utilisateur.
    """
    stale_tokens = [
        message["to"]
        for message, ticket in zip(batch, tickets)
        if ticket.get("status") == "error"
        and ticket.get("details", {}).get("error") == "DeviceNotRegistered"
    ]
    if stale_tokens:
        DeviceToken.objects.filter(token__in=stale_tokens).delete()
