from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from ..models import ProjectMember, ProjectOwnerRate
from ..utils import get_user_display_name
from .permissions import has_project_permission


def get_project_members(user, project_id):
    return ProjectMember.objects.for_project(project_id).accessible_to(user).with_relations().order_by("id")


def owner_matches_member_filters(project, request):
    """Est-ce que la ligne "propriétaire" fictive (voir `build_owner_member_entry`)
    correspond aux paramètres `user`/`role`/`search` actifs de `ProjectMemberListView` ?
    Sans ça, cette ligne fictive apparaîtrait toujours, même sous un filtre qui ne la
    concerne pas.

    À garder synchronisé avec `ProjectMemberListView.filterset_fields`/`search_fields` :
    ces mêmes paramètres sont revérifiés à la main ici car la ligne fictive n'a pas de
    ligne `ProjectMember` en base pour que `SearchFilter`/`DjangoFilterBackend` puisse
    la traiter. Un nouveau filtre ajouté à cette vue doit avoir son équivalent ici,
    sinon il sera silencieusement ignoré pour cette ligne.
    """
    params = request.query_params

    user_param = params.get("user")
    if user_param and user_param != str(project.owner_id):
        return False

    if params.get("role"):
        # La ligne fictive n'a pas de vrai rôle (id sentinelle 0) : aucun filtre
        # `role` par un vrai id ne peut donc jamais la concerner.
        return False

    search = params.get("search", "").strip().lower()
    if search:
        fields = [
            project.owner.email,
            project.owner.first_name,
            project.owner.last_name,
            project.owner.username,
            "Proprietaire",
        ]
        if not any(search in (field or "").lower() for field in fields):
            return False

    return True


def build_owner_member_entry(project):
    """Fabrique une entrée au format `ProjectMemberSerializer` pour le propriétaire du
    projet.

    Le flux applicatif normal (invitations) ne peut jamais créer de vraie ligne
    `ProjectMember` pour le propriétaire : `create_project_invitation` refuse toute
    invitation vers son propre email (voir `_is_already_project_member`). Le seul cas
    où une telle ligne existerait est une création manuelle via le Django admin — d'où
    la vérification défensive faite par les appelants plutôt qu'une hypothèse
    "le propriétaire n'a jamais de ligne"."""
    display_name = get_user_display_name(project.owner)
    now = timezone.now().isoformat()
    try:
        picture_url = project.owner.profile.picture_url or None
    except AttributeError:
        picture_url = None
    try:
        hourly_rate = str(project.owner_rate.hourly_rate)
    except ProjectOwnerRate.DoesNotExist:
        hourly_rate = "0.00"
    return {
        "id": 0,
        "project": project.id,
        "user": project.owner_id,
        "user_display_name": display_name,
        "user_email": project.owner.email,
        "user_picture_url": picture_url,
        "role": 0,
        "role_name": "Proprietaire",
        "role_deleted": False,
        "hourly_rate": hourly_rate,
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
        "deleted_by": None,
    }


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
