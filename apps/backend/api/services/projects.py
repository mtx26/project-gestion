from django.db import models

from ..models import Project


def get_accessible_projects(user, include_deleted=False):
    if not user or not user.is_authenticated:
        manager = Project.all_objects if include_deleted else Project.objects
        return manager.none()

    manager = Project.all_objects if include_deleted else Project.objects

    return manager.filter(
        models.Q(owner=user)
        | models.Q(projectmember__user=user, projectmember__deleted_at__isnull=True),
    ).select_related("owner").distinct().order_by("id")


def get_accessible_deleted_projects(user):
    if not user or not user.is_authenticated:
        return Project.deleted_objects.none()

    return get_accessible_projects(user, include_deleted=True).filter(
        deleted_at__isnull=False,
    )
