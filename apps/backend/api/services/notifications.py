from ..models import Notification
from .push import send_push_notification


def notify(
    *,
    user,
    type,
    title,
    message,
    project=None,
    created_by=None,
    data=None,
    channels=None,
):
    """
    Create an in-app notification and dispatch to the requested channels.

    channels: list containing any of "in_app", "push". Defaults to both.
    """
    if channels is None:
        channels = ["in_app", "push"]

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
        send_push_notification(user=user, title=title, message=message, data=data)

    return notification
