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
):
    notification = Notification.objects.create(
        user=user,
        project=project,
        created_by=created_by,
        type=type,
        title=title,
        message=message,
        data=data or {},
    )
    send_push_notification(user=user, title=title, message=message, data=data)
    return notification
