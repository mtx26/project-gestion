from ..models import Role


def get_project_roles(user, project_id):
    return Role.objects.for_project(project_id).accessible_to(user).with_relations().order_by("id")


def get_project_deleted_roles(user, project_id):
    return Role.deleted_objects.for_project(project_id).accessible_to(user).with_relations().order_by("id")
