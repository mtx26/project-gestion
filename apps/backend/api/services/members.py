from django.contrib.auth.models import User
from django.db import models

from ..models import ProjectMember
from .projects import get_accessible_projects


def get_project_members(user, project_id):
    return ProjectMember.objects.select_related("user__profile", "role").filter(
        project_id=project_id,
        project__in=get_accessible_projects(user),
    ).order_by("id")


def get_project_assignable_users(project):
    return User.objects.filter(
        models.Q(pk=project.owner_id)
        | models.Q(
            projectmember__project=project,
            projectmember__deleted_at__isnull=True,
        )
    ).distinct()
