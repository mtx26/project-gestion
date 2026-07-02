from django.contrib.auth.models import User
from django.db import models
from rest_framework.exceptions import PermissionDenied

from ..models import ProjectMember
from .permissions import has_project_permission
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


def authorize_member_update(user, project, member, data):
    """Raise PermissionDenied unless `user` may apply this ProjectMember update."""
    changing_role = "role" in data
    changing_rate = "hourly_rate" in data

    if changing_role and not has_project_permission(user, project, "member.edit"):
        raise PermissionDenied("errors.member.no_permission_edit")

    if changing_rate:
        is_own = member.user_id == user.id
        can_edit_rates = has_project_permission(user, project, "member.edit_rates")
        can_edit_own_rate = has_project_permission(user, project, "member.edit_own_rate")

        if is_own:
            if not (can_edit_own_rate or can_edit_rates):
                raise PermissionDenied("errors.member.no_permission_edit_own_rate")
        elif not can_edit_rates:
            raise PermissionDenied("errors.member.no_permission_edit_rates")

    if not changing_rate and not changing_role:
        raise PermissionDenied("errors.member.no_fields_to_update")


def detach_member_from_project(member):
    """Null out records authored by this member and drop their task assignments."""
    from ..models import ExpenseRequest, FinancialEntry, Task, TimeEntry

    user_id = member.user_id
    project_id = member.project_id

    Task.all_objects.filter(project_id=project_id, created_by_id=user_id).update(created_by=None)
    TimeEntry.all_objects.filter(project_id=project_id, user_id=user_id).update(user=None)
    FinancialEntry.all_objects.filter(project_id=project_id, created_by_id=user_id).update(created_by=None)
    ExpenseRequest.all_objects.filter(project_id=project_id, requested_by_id=user_id).update(requested_by=None)

    task_user_through = Task._meta.get_field("assigned_to").remote_field.through
    task_user_through.objects.filter(task__project_id=project_id, user_id=user_id).delete()
