from ..models import Project


def get_accessible_projects(user, include_deleted=False):
    manager = Project.all_objects if include_deleted else Project.objects
    return manager.accessible_to(user)


def get_accessible_deleted_projects(user):
    return Project.deleted_objects.accessible_to(user)
