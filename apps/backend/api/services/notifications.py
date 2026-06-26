from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist

from ..constants import NotificationType
from ..models import Notification
from .mail import send_email
from .push import send_push_notification

# Maps notification type → settings attribute holding the Resend template ID.
# Add an entry here whenever a new notification type needs an email template.
_EMAIL_TEMPLATES = {
    NotificationType.PROJECT_INVITATION: "RESEND_INVITATION_TEMPLATE_ID",
}


def notify(
    *,
    user,
    type,
    title,
    message,
    channels,
    project=None,
    created_by=None,
    data=None,
    to_email=None,
):
    """
    Dispatch a notification to the requested channels.

    channels: subset of ["in_app", "push", "email"].

    - "in_app" : persisted to DB. Requires user (skipped when user is None).
    - "push"   : sent via FCM. Requires user + profile.notification_push == True.
    - "email"  : sent via Resend template resolved from _EMAIL_TEMPLATES.
                 Recipient is user.email when user exists, to_email otherwise.
                 Skipped when user exists but has no profile, or
                 profile.notification_email == False.
                 Skipped when user is None and to_email is not provided.

    data is passed as Resend template variables when sending email.
    """
    try:
        profile = user.profile if user is not None else None
    except ObjectDoesNotExist:
        profile = None

    notification = None

    if "in_app" in channels and user is not None:
        notification = Notification.objects.create(
            user=user,
            project=project,
            created_by=created_by,
            type=type,
            title=title,
            message=message,
            data=data or {},
        )

    if "push" in channels and user is not None:
        push_enabled = profile.notification_push if profile is not None else True
        if push_enabled:
            send_push_notification(user=user, title=title, message=message, data=data)

    if "email" in channels:
        recipient = user.email if user is not None else to_email
        email_allowed = (
            recipient is not None
            and (user is None or (profile is not None and profile.notification_email))
        )
        if email_allowed:
            template_id = _resolve_email_template_id(type)
            send_email(
                to_email=recipient,
                subject=title,
                type=type,
                resend_template_id=template_id,
                resend_template_variables=data or {},
                reply_to=settings.DEFAULT_REPLY_TO_EMAIL,
            )

    return notification


def _resolve_email_template_id(notification_type):
    setting_name = _EMAIL_TEMPLATES.get(notification_type)
    if not setting_name:
        return None
    return getattr(settings, setting_name, None) or None
