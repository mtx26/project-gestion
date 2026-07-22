import secrets

from ..models import ProjectCalendarSubscription


def get_calendar_subscription(user, project_id):
    return ProjectCalendarSubscription.objects.filter(project_id=project_id, user=user).first()


def create_or_update_calendar_subscription(*, project, user, include_tasks, include_time):
    subscription = ProjectCalendarSubscription.objects.filter(project=project, user=user).first()
    if subscription is None:
        subscription = ProjectCalendarSubscription(project=project, user=user, token=secrets.token_urlsafe(32))

    subscription.include_tasks = include_tasks
    subscription.include_time = include_time
    subscription.full_clean()
    subscription.save()

    return subscription
