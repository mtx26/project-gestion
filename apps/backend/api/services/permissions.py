from django.db.models import Q

from ..models import Project


def build_project_access_filter(user, permission_code=None):
    owner_access = Q(owner=user)

    if permission_code is None:
        member_access = Q(projectmember__user=user)
    else:
        member_access = Q(
            projectmember__user=user,
            projectmember__role__rolepermission__permission__code=permission_code,
        )

    return owner_access | member_access


def get_allowed_projects(user, permission_code=None, deleted=False):
    if deleted:
        project_queryset = Project.deleted_objects.all()
    else:
        project_queryset = Project.objects.all()

    if not user or not user.is_authenticated:
        return project_queryset.none()

    return project_queryset.filter(
        build_project_access_filter(user, permission_code)
    ).distinct()


def get_allowed_project(user, project_id, permission_code=None, deleted=False):
    return get_allowed_projects(
        user,
        permission_code=permission_code,
        deleted=deleted,
    ).filter(pk=project_id)


def filter_allowed_project(queryset, user, project_id, permission_code=None):
    return queryset.filter(
        project_id=project_id,
        project__in=get_allowed_projects(user, permission_code=permission_code),
    )
