from django.db import models

from ..models import Project, ProjectMember


def get_accessible_projects(user):
    if not user or not user.is_authenticated:
        return Project.objects.none()

    return Project.objects.filter(
        models.Q(owner=user)
        | models.Q(
            projectmember__user=user,
            projectmember__role__rolepermission__permission__code="project.view",
            projectmember__role__rolepermission__deleted_at__isnull=True,
        ),
    ).distinct()


def get_accessible_deleted_projects(user):
    if not user or not user.is_authenticated:
        return Project.deleted_objects.none()

    return Project.deleted_objects.filter(
        models.Q(owner=user)
        | models.Q(
            projectmember__user=user,
            projectmember__role__rolepermission__permission__code="project.view",
            projectmember__role__rolepermission__deleted_at__isnull=True,
        ),
    ).distinct()


def is_project_member(user, project):
    if not user or not user.is_authenticated or project is None:
        return False

    if project.owner_id == user.id:
        return True

    return ProjectMember.objects.filter(
        project=project,
        user=user,
    ).exists()
