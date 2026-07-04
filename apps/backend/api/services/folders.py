def get_project_folders(user, project_id):
    from ..models import Folder

    return Folder.objects.for_project(project_id).accessible_to(user).with_relations()


def get_project_deleted_folders(user, project_id):
    from ..models import Folder

    return Folder.deleted_objects.for_project(project_id).accessible_to(user).with_relations()


def get_descendant_folder_ids(folder_id, project_id):
    """Return the set of all folder IDs in the subtree rooted at folder_id (inclusive)."""
    from ..models import Folder

    ids = {folder_id}
    queue = [folder_id]
    while queue:
        children = list(
            Folder.objects.filter(parent_folder_id__in=queue, project_id=project_id)
            .values_list("id", flat=True)
        )
        ids.update(children)
        queue = children
    return ids
