from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from ..models import EmailDelivery


def send_email(
    *,
    to_email,
    subject,
    type,
    text_body="",
    metadata=None,
    invitation=None,
    reply_to=None,
    resend_template_id=None,
    resend_template_variables=None,
):
    metadata = metadata or {}
    resend_template_variables = resend_template_variables or {}

    delivery = EmailDelivery.objects.create(
        to_email=to_email,
        subject=subject,
        type=type,
        metadata=metadata,
        invitation=invitation,
    )

    message = EmailMessage(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
        reply_to=[reply_to] if reply_to else None,
    )

    message.tags = [type]
    message.metadata = {
        **metadata,
        "email_delivery_id": str(delivery.id),
        "type": type,
    }
    if resend_template_id:
        if settings.EMAIL_BACKEND == "anymail.backends.resend.EmailBackend":
            # Resend rejects requests that include `text` with a template.
            # Anymail treats body=None as "do not serialize a text body".
            message.body = None
        message.esp_extra = {
            "template": {
                "id": resend_template_id,
                "variables": resend_template_variables,
            },
            "tags": [
                {"name": "type", "value": _sanitize_resend_tag_value(type)},
                {"name": "email_delivery_id", "value": str(delivery.id)},
            ],
        }

    try:
        message.send()
    except Exception as exc:
        delivery.status = EmailDelivery.Status.FAILED
        delivery.error_message = str(exc)
        delivery.save(update_fields=["status", "error_message", "updated_at"])

        raise

    anymail_status = getattr(message, "anymail_status", None)
    delivery.provider_message_id = getattr(anymail_status, "message_id", None)
    delivery.status = EmailDelivery.Status.SENT
    delivery.sent_at = timezone.now()
    delivery.error_message = None
    delivery.save(update_fields=[
        "provider_message_id",
        "status",
        "sent_at",
        "error_message",
        "updated_at",
    ])

    return delivery


def _sanitize_resend_tag_value(value):
    return "".join(
        character
        if character.isascii() and (character.isalnum() or character in {"_", "-"})
        else "_"
        for character in value
    )[:256]
