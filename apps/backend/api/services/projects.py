from django.db.models import Q

from ..models import Project


def get_accessible_projects(user):
    return Project.objects.filter(
        Q(owner=user) |
        Q(projectmember__user=user)
    ).distinct()

def get_accessible_deleted_projects(user):
    return Project.all_objects.filter(
        Q(owner=user) |
        Q(projectmember__user=user),
        deleted_at__isnull=False
    ).distinct()