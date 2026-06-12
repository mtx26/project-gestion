from ..models import Notification


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
    return Notification.objects.create(
        user=user,
        project=project,
        created_by=created_by,
        type=type,
        title=title,
        message=message,
        data=data or {},
    )
