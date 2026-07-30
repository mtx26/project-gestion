"""Single entry point for project-scoped authorization.

`ProjectAuthorization(user, project)` answers every "can this user do X on this
project" question the app asks — it is the one place that knows a project's owner
bypasses RBAC entirely, and the one place that queries `Permission` for members.
`ProjectAuthorizationMap` is the batched variant, for serializing lists without one
query per row. `HasProjectPermission`/`PermissionCodeByMethodMixin` are the DRF-facing
adapter that wires a view's declared `permission_code` to `ProjectAuthorization`.

Not in scope here (each lives with the resource it concerns, not with authorization):
- `TimeEntryQuerySet.own_unless_has_permission` (models.py) — row-level restriction,
  not an allow/deny decision.
- `authorize_member_update` (services/members.py) — permission that depends on which
  fields are being changed, not a static `permission_code`.
- `PERMISSION_DEPENDENCY_CODES`/`expand_permissions`/`get_role_permissions_map`
  (services/roles.py) — role-creation UX, never consulted at authorization time.
"""

from rest_framework.permissions import BasePermission

from .models import Permission, Project
from .services.projects import get_accessible_projects

# Sentinel `permission_code` value meaning "only the project owner may do this" — for
# the handful of actions with no RBAC permission code of their own (deleting/restoring
# a project, changing the owner's own hourly rate).
OWNER_ONLY = "__owner__"


class ProjectAuthorization:
    """What `user` may do on `project`: everything if they own it, otherwise only
    what their role's active `RolePermission` rows grant. Use `has_all` over
    several `has` calls when a single action needs more than one code — it's
    one query instead of one per code."""

    def __init__(self, user, project):
        self.user = user
        self.project = project

    @property
    def is_owner(self):
        return bool(
            self.user
            and self.user.is_authenticated
            and self.project
            and self.project.owner_id == self.user.id
        )

    def has(self, code):
        if not code:
            return False
        if self.is_owner:
            return True
        return Permission.objects.for_user_on_project(self.user, self.project).filter(code=code).exists()

    def has_all(self, codes):
        """Like `has`, but for several codes at once — one query instead of one
        per code (used when a single action needs more than one permission,
        e.g. creating a task and recording time together)."""
        codes = set(codes)
        if not codes:
            return True
        if self.is_owner:
            return True
        if OWNER_ONLY in codes:
            # No non-owner can ever satisfy this — `OWNER_ONLY` isn't a real
            # `Permission.code`, so skip the query rather than rely on it
            # never matching one.
            return False
        granted = set(
            Permission.objects.for_user_on_project(self.user, self.project)
            .filter(code__in=codes)
            .values_list("code", flat=True)
        )
        return codes.issubset(granted)

    def codes(self):
        return list(
            Permission.objects.for_user_on_project(self.user, self.project)
            .order_by("code")
            .values_list("code", flat=True)
            .distinct()
        )


class ProjectAuthorizationMap:
    """Batched `ProjectAuthorization(user, project).codes()` for many projects at
    once — one query covers every project the user owns, one covers every project
    where they're a member, instead of one query per project."""

    def __init__(self, user, projects):
        self._codes_by_project = self._compute(user, list(projects))

    def codes_for(self, project):
        return self._codes_by_project.get(project.id, [])

    @staticmethod
    def _compute(user, projects):
        if not user or not user.is_authenticated:
            return {project.id: [] for project in projects}

        owned_ids = {project.id for project in projects if project.owner_id == user.id}
        member_ids = [project.id for project in projects if project.id not in owned_ids]

        codes_by_project = {}

        if owned_ids:
            all_codes = list(Permission.objects.order_by("code").values_list("code", flat=True))
            for project_id in owned_ids:
                codes_by_project[project_id] = all_codes

        if member_ids:
            member_codes = {}
            rows = Permission.objects.filter(
                rolepermission__role__projectmember__project_id__in=member_ids,
                rolepermission__role__projectmember__user=user,
                rolepermission__deleted_at__isnull=True,
                rolepermission__role__deleted_at__isnull=True,
                rolepermission__role__projectmember__deleted_at__isnull=True,
            ).values_list("rolepermission__role__projectmember__project_id", "code").distinct()

            for project_id, code in rows:
                member_codes.setdefault(project_id, set()).add(code)

            for project_id in member_ids:
                codes_by_project[project_id] = sorted(member_codes.get(project_id, set()))

        return codes_by_project


class PermissionCodeByMethodMixin:
    """Sets `permission_code` for `HasProjectPermission` from a per-HTTP-method mapping.

    Declare `permission_codes_by_method = {"GET": "task.view", "POST": "task.edit"}`.
    A method not present in the mapping resolves to `None` (no fine-grained check beyond
    project access) — use this when the real permission code can't be known until the
    request body is inspected (e.g. `ProjectMemberDetailView` omits PUT/PATCH here and
    calls `services.members.authorize_member_update` from `perform_update` instead,
    since editing a member's own hourly rate vs. someone else's role requires different
    codes depending on which fields changed).
    """

    permission_codes_by_method: dict = {}

    def get_permissions(self):
        self.permission_code = self.permission_codes_by_method.get(self.request.method)
        return super().get_permissions()


class HasProjectPermission(BasePermission):
    """DRF checks `has_permission` (before the view method runs, from `project_id` in
    the URL) and `has_object_permission` (when the view calls `get_object()`) as two
    separate steps. For every nested detail/update/delete/restore view, both fire in
    the same request against the same project — `has_object_permission`'s `obj` always
    belongs to the `project_id` already resolved, since `get_queryset()` is itself
    scoped to that project. The result is cached on `view` so the second check reuses
    it instead of re-querying project access and the RBAC permission code.

    `permission_code` may be a single code or a list — a list requires all of them
    (e.g. an action that both creates a task and records time)."""

    def has_permission(self, request, view):
        project_id = view.kwargs.get("project_id")

        if project_id is None:
            return True

        project = get_accessible_projects(
            request.user,
            include_deleted=True,
        ).filter(pk=project_id).first()
        if project is None:
            return False

        allowed = self._is_allowed(request, view, project)
        view._project_permission_cache = (project.pk, allowed)
        return allowed

    def has_object_permission(self, request, view, obj):
        project = obj if isinstance(obj, Project) else getattr(obj, "project", None)

        if project is None:
            return False

        cached = getattr(view, "_project_permission_cache", None)
        if cached is not None and cached[0] == project.pk:
            return cached[1]

        if not get_accessible_projects(
            request.user,
            include_deleted=True,
        ).filter(pk=project.pk).exists():
            return False

        return self._is_allowed(request, view, project)

    def _is_allowed(self, request, view, project):
        permission_code = getattr(view, "permission_code", None)
        if permission_code is None:
            return True

        codes = [permission_code] if isinstance(permission_code, str) else permission_code
        return ProjectAuthorization(request.user, project).has_all(codes)
