from ..models import Task


def get_project_tasks(user, project_id):
    return Task.objects.for_project(project_id).accessible_to(user).with_relations()


def get_project_deleted_tasks(user, project_id):
    return Task.deleted_objects.for_project(project_id).accessible_to(user).with_relations()
