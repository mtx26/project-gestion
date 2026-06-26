from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist

from ..constants import NotificationType
from ..models import Notification
from .mail import send_email
from .push import send_push_notification

# Resend template ID setting name per notification type.
_EMAIL_TEMPLATES = {
    NotificationType.PROJECT_INVITATION: "RESEND_INVITATION_TEMPLATE_ID",
}

def notify(*, user, type, title, message, data=None, project=None, created_by=None, to_email=None, channels=["in_app", "push", "email"]):
    if user is None:
        if to_email:
            _send_notification_email(to_email=to_email, type=type, title=title, data=data)
        return None

    try:
        profile = user.profile
    except ObjectDoesNotExist:
        profile = None

    notification = None

    if "in_app" in channels:
        notification = Notification.objects.create(
            user=user,
            project=project,
            created_by=created_by,
            type=type,
            title=title,
            message=message,
            data=data or {},
        )

    if profile is None:
        channels = ["in_app"]

    if "push" in channels and profile.notification_push:
        send_push_notification(user=user, title=title, message=message, data=data)

    if "email" in channels and profile.notification_email:
        _send_notification_email(to_email=user.email, type=type, title=title, data=data)

    return notification


def _send_notification_email(*, to_email, type, title, data):
    setting_name = _EMAIL_TEMPLATES.get(type)
    template_id = getattr(settings, setting_name, None) or None if setting_name else None

    send_email(
        to_email=to_email,
        subject=title,
        type=type,
        resend_template_id=template_id,
        resend_template_variables=data or {},
        reply_to=settings.DEFAULT_REPLY_TO_EMAIL,
    )
