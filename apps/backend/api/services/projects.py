from django.db import models

from ..models import Project, ProjectMember


def get_accessible_projects(user, include_deleted=False):
    if not user or not user.is_authenticated:
        manager = Project.all_objects if include_deleted else Project.objects
        return manager.none()

    manager = Project.all_objects if include_deleted else Project.objects

    return manager.filter(
        models.Q(owner=user)
        | models.Q(projectmember__user=user),
    ).distinct().order_by("id")


def get_accessible_deleted_projects(user):
    if not user or not user.is_authenticated:
        return Project.deleted_objects.none()

    return get_accessible_projects(user, include_deleted=True).filter(
        deleted_at__isnull=False,
    )


def is_project_member(user, project):
    if not user or not user.is_authenticated or project is None:
        return False

    if project.owner_id == user.id:
        return True

    return ProjectMember.objects.filter(
        project=project,
        user=user,
    ).exists()
