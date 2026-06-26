import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_firebase_app = None


def _get_firebase_app():
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    credentials_json = getattr(settings, "FIREBASE_CREDENTIALS_JSON", "")
    if not credentials_json:
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials

        cred = credentials.Certificate(json.loads(credentials_json))
        _firebase_app = firebase_admin.initialize_app(cred)
        return _firebase_app
    except Exception:
        logger.exception("Failed to initialize Firebase app")
        return None


def send_push_notification(*, user, title, message, data=None):
    """Send a FCM push notification to all active devices of a user."""
    app = _get_firebase_app()
    if app is None:
        return

    from ..models import UserDevice

    tokens = list(
        UserDevice.objects.filter(user=user, is_active=True).values_list("fcm_token", flat=True)
    )
    if not tokens:
        return

    try:
        from firebase_admin import messaging

        messages = [
            messaging.Message(
                notification=messaging.Notification(title=title, body=message),
                data={k: str(v) for k, v in (data or {}).items()},
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        title=title,
                        body=message,
                    ),
                ),
                token=token,
            )
            for token in tokens
        ]

        response = messaging.send_each(messages)
        _deactivate_unregistered_tokens(response, tokens)
    except Exception:
        logger.exception("Failed to send FCM push notifications to user %s", user.pk)


def _deactivate_unregistered_tokens(response, tokens):
    from firebase_admin import messaging
    from ..models import UserDevice

    invalid_tokens = [
        tokens[i]
        for i, result in enumerate(response.responses)
        if not result.success and isinstance(result.exception, messaging.UnregisteredError)
    ]

    if invalid_tokens:
        UserDevice.objects.filter(fcm_token__in=invalid_tokens).update(is_active=False)
        logger.info("Deactivated %d unregistered FCM tokens", len(invalid_tokens))
