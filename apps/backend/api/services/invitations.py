import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import Invitation, Notification, ProjectMember
from .mail import send_email
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
            deleted_at__isnull=True,
        ).update(
            deleted_at=now,
            deleted_by=invited_by,
            updated_at=now,
        )

        if Invitation.objects.filter(
            project=project,
            email__iexact=email,
            accepted_at__isnull=True,
            deleted_at__isnull=True,
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

        if invited_user:
            notify(
                user=invited_user,
                project=project,
                created_by=invited_by,
                type="project_invitation",
                title="Invitation a un projet",
                message=f"Vous avez ete invite au projet {project.name}.",
                data={"invitation_id": invitation.id, "token": invitation.token},
            )
        else:
            send_invitation_email(invitation)

    return invitation


def send_invitation_email(invitation):
    invitation_url = _build_invitation_url(invitation.token)
    metadata = {
        "invitation_id": str(invitation.id),
        "project_id": str(invitation.project_id),
    }

    return send_email(
        to_email=invitation.email,
        subject=f"Invitation au projet {invitation.project.name}",
        type="project_invitation",
        resend_template_id=settings.RESEND_INVITATION_TEMPLATE_ID or None,
        resend_template_variables={
            "PROJECT_NAME": invitation.project.name,
            "INVITER_NAME": invitation.invited_by.get_username(),
            "INVITATION_URL": invitation_url,
            "EXPIRES_AT": f"{invitation.expires_at:%Y-%m-%d %H:%M}",
        },
        text_body=(
            f"{invitation.invited_by.get_username()} vous a invite au projet "
            f"{invitation.project.name}.\n\n"
            f"Accepter l'invitation : {invitation_url}\n\n"
            f"Cette invitation expire le {invitation.expires_at:%Y-%m-%d %H:%M}."
        ),
        metadata=metadata,
        invitation=invitation,
        reply_to=settings.DEFAULT_REPLY_TO_EMAIL,
    )


def accept_project_invitation(*, token, user):
    now = timezone.now()

    with transaction.atomic():
        invitation = Invitation.objects.select_for_update().select_related(
            "project",
            "role",
            "invited_by",
        ).filter(
            token=token,
            deleted_at__isnull=True,
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
                deleted_at__isnull=True,
            ).first()
            if member:
                return invitation, member
            raise ValidationError({"token": "errors.invitation.already_accepted"})

        member = _get_or_create_project_member(invitation, user)
        invitation.accepted_at = now
        invitation.save(update_fields=["accepted_at", "updated_at"])
        Notification.objects.filter(
            user=user,
            type="project_invitation",
            data__invitation_id=invitation.id,
            is_read=False,
        ).update(is_read=True, updated_at=now)

        notify(
            user=invitation.invited_by,
            project=invitation.project,
            created_by=user,
            type="project_invitation_accepted",
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
