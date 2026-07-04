from ..models import Document


def get_project_documents(user, project_id):
    return Document.objects.for_project(project_id).accessible_to(user)


def get_project_deleted_documents(user, project_id):
    return Document.deleted_objects.for_project(project_id).accessible_to(user)
