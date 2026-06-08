from .permissions import get_allowed_projects


def get_accessible_projects(user):
    return get_allowed_projects(user)


def get_accessible_deleted_projects(user):
    return get_allowed_projects(user, deleted=True)
