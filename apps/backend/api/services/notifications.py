from django.core.exceptions import ObjectDoesNotExist

from ..models import Notification
from .mail import send_email
from .push import send_push_notification


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
    # Email params — required when "email" is in channels
    email_subject=None,
    email_template_id=None,
    email_template_variables=None,
    email_metadata=None,
):
    """
    Create an in-app notification and dispatch to extra channels based on the
    user's notification preferences stored on their Profile.

    channels: list of intended channels — "in_app", "push", "email".

    Rules:
    - "in_app" is always dispatched when listed.
    - "push" requires profile.notification_push == True.
    - "email" requires profile to exist AND profile.notification_email == True.
      If the user has no profile, email is silently skipped.
    """
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

    if "push" in channels:
        push_enabled = profile.notification_push if profile is not None else True
        if push_enabled:
            send_push_notification(user=user, title=title, message=message, data=data)

    if "email" in channels and profile is not None and profile.notification_email:
        send_email(
            to_email=user.email,
            subject=email_subject or title,
            type=type,
            resend_template_id=email_template_id,
            resend_template_variables=email_template_variables or {},
            metadata=email_metadata or {},
        )

    return notification
