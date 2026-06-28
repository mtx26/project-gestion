import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..constants import NotificationType
from ..models import Invitation, Notification, ProjectMember
from .notifications import notify
from .projects import get_accessible_projects


def normalize_invitation_email(email):
    return User.objects.normalize_email(email).strip().lower()


def get_project_invitations(user, project_id):
    return Invitation.objects.select_related(
        "project",
        "role",
        "invited_by",
    ).filter(
        project_id=project_id,
        project__in=get_accessible_projects(user),
        accepted_at__isnull=True,
    ).order_by("-created_at", "-id")


def create_project_invitation(*, project, email, role, invited_by):
    email = normalize_invitation_email(email)
    invited_user = User.objects.filter(email__iexact=email).first()
    now = timezone.now()

    if role.project_id != project.id:
        raise ValidationError({"role": "errors.invitation.role_project_mismatch"})

    if _is_already_project_member(project, invited_user):
        raise ValidationError({"email": "errors.invitation.user_already_project_member"})

    with transaction.atomic():
        Invitation.objects.filter(
            project=project,
            email__iexact=email,
            accepted_at__isnull=True,
            expires_at__lte=now,
        ).update(
            deleted_at=now,
            deleted_by=invited_by,
            updated_at=now,
        )

        if Invitation.objects.filter(
            project=project,
            email__iexact=email,
            accepted_at__isnull=True,
        ).exists():
            raise ValidationError({"email": "errors.invitation.already_pending"})

        invitation = Invitation.objects.create(
            project=project,
            email=email,
            role=role,
            invited_by=invited_by,
            token=secrets.token_urlsafe(32),
            expires_at=now + timedelta(days=settings.INVITATION_EXPIRES_DAYS),
        )
        invitation.full_clean()

        invitation_data = {
            "invitation_id": invitation.id,
            "token": invitation.token,
            # Resend template variables
            "PROJECT_NAME": project.name,
            "INVITER_NAME": invited_by.get_username(),
            "INVITATION_URL": _build_invitation_url(invitation.token),
            "EXPIRES_AT": f"{invitation.expires_at:%Y-%m-%d %H:%M}",
        }

        notify(
            user=invited_user,
            to_email=invitation.email,
            project=project,
            created_by=invited_by,
            type=NotificationType.PROJECT_INVITATION,
            title="Invitation a un projet",
            message=f"Vous avez ete invite au projet {project.name}.",
            data=invitation_data,
        )

    return invitation


def accept_project_invitation(*, token, user):
    now = timezone.now()

    with transaction.atomic():
        invitation = Invitation.objects.select_for_update().select_related(
            "project",
            "role",
            "invited_by",
        ).filter(
            token=token,
        ).first()

        if invitation is None:
            raise ValidationError({"token": "errors.invitation.invalid_token"})

        if invitation.expires_at <= now:
            raise ValidationError({"token": "errors.invitation.expired"})

        if normalize_invitation_email(user.email) != invitation.email:
            raise ValidationError({"token": "errors.invitation.email_mismatch"})

        if invitation.accepted_at is not None:
            member = ProjectMember.objects.filter(
                project=invitation.project,
                user=user,
            ).first()
            if member:
                return invitation, member
            raise ValidationError({"token": "errors.invitation.already_accepted"})

        member = _get_or_create_project_member(invitation, user)
        invitation.accepted_at = now
        invitation.save(update_fields=["accepted_at", "updated_at"])
        Notification.objects.filter(
            user=user,
            type=NotificationType.PROJECT_INVITATION,
            data__invitation_id=invitation.id,
        ).update(
            is_read=True,
            deleted_at=now,
            deleted_by=user,
            updated_at=now,
        )

        notify(
            user=invitation.invited_by,
            project=invitation.project,
            created_by=user,
            type=NotificationType.PROJECT_INVITATION_ACCEPTED,
            title="Invitation acceptee",
            message=f"{user.email} a rejoint le projet {invitation.project.name}.",
        )

    return invitation, member


def _build_invitation_url(token):
    query = urlencode({"token": token})
    return f"{settings.FRONTEND_APP_URL.rstrip('/')}/invitations/accept?{query}"


def _is_already_project_member(project, user):
    if user is None:
        return False

    if project.owner_id == user.id:
        return True

    return ProjectMember.objects.filter(project=project, user=user).exists()


def _get_or_create_project_member(invitation, user):
    member, _ = ProjectMember.objects.get_or_create(
        project=invitation.project,
        user=user,
        defaults={"role": invitation.role},
    )
    member.full_clean()
    return member
