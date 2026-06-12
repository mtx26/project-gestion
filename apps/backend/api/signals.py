from django.dispatch import receiver
from django.utils import timezone

from anymail.signals import tracking

from .models import EmailDelivery


TRACKING_STATUS_MAP = {
    "sent": EmailDelivery.Status.SENT,
    "delivered": EmailDelivery.Status.DELIVERED,
    "failed": EmailDelivery.Status.FAILED,
    "rejected": EmailDelivery.Status.FAILED,
    "bounced": EmailDelivery.Status.BOUNCED,
    "deferred": EmailDelivery.Status.DEFERRED,
    "complained": EmailDelivery.Status.COMPLAINED,
    "opened": EmailDelivery.Status.OPENED,
    "clicked": EmailDelivery.Status.CLICKED,
}

TRACKING_TIMESTAMP_FIELDS = {
    "sent": "sent_at",
    "delivered": "delivered_at",
    "bounced": "bounced_at",
    "complained": "complained_at",
    "opened": "opened_at",
    "clicked": "clicked_at",
}


@receiver(tracking)
def update_email_delivery_from_tracking(sender, event, esp_name, **kwargs):
    delivery = _find_email_delivery(event)

    if delivery is None:
        return

    status = TRACKING_STATUS_MAP.get(event.event_type)
    if status is None:
        return

    update_fields = ["status", "updated_at"]
    delivery.status = status

    timestamp_field = TRACKING_TIMESTAMP_FIELDS.get(event.event_type)
    if timestamp_field:
        setattr(delivery, timestamp_field, event.timestamp or timezone.now())
        update_fields.append(timestamp_field)

    error_message = event.description or event.mta_response or event.reject_reason
    if error_message:
        delivery.error_message = error_message
        update_fields.append("error_message")

    delivery.save(update_fields=update_fields)


def _find_email_delivery(event):
    delivery_id = event.metadata.get("email_delivery_id") if event.metadata else None

    if delivery_id:
        delivery = EmailDelivery.objects.filter(pk=delivery_id).first()
        if delivery:
            return delivery

    if event.message_id:
        return EmailDelivery.objects.filter(
            provider_message_id=event.message_id,
        ).first()

    return None
