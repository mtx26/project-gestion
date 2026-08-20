from django.db import transaction

from ..models import Notification
from .push import send_push_to_user


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

    # Envoi push apres commit : la notification en base fait foi, et un appel
    # reseau n'a rien a faire dans la transaction de l'action metier (elle peut
    # encore etre annulee). `notification_id` permet a l'app de rebondir sur la
    # bonne ligne quand l'utilisateur tape la notification.
    transaction.on_commit(
        lambda: send_push_to_user(
            user=user,
            title=title,
            body=message,
            data={**(data or {}), "type": type, "notification_id": notification.pk},
        )
    )

    return notification
