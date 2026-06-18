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


def build_document_tree_node(document):
    return {
        "type": "document",
        "id": document.id,
        "name": document.name,
        "description": document.description,
        "file_name": document.file_name,
        "file_size": document.file_size,
        "mime_type": document.mime_type,
    }


def build_task_tree_node(task):
    return {
        "type": "task",
        "id": task.id,
        "name": task.title,
        "description": task.description,
        "folder": task.folder_id,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date.isoformat() if task.due_date else None,
    }


def build_folder_tree(folders, documents=None, tasks=None):
    folder_nodes = {}
    roots = []

    for folder in folders:
        created_by = getattr(folder, "created_by", None)
        if created_by is not None:
            full_name = (created_by.get_full_name() or "").strip()
            created_by_name = full_name or created_by.username or created_by.email
        else:
            created_by_name = None
        folder_nodes[folder.id] = {
            "type": "folder",
            "id": folder.id,
            "name": folder.name,
            "description": folder.description,
            "color": folder.color,
            "icon": folder.icon,
            "created_by_name": created_by_name,
            "children": [],
        }

    for folder in folders:
        node = folder_nodes[folder.id]
        parent_id = folder.parent_folder_id
        if parent_id and parent_id in folder_nodes:
            folder_nodes[parent_id]["children"].append(node)
        else:
            roots.append(node)

    for items, build_fn in [
        (tasks or [], build_task_tree_node),
        (documents or [], build_document_tree_node),
    ]:
        for obj in items:
            node = build_fn(obj)
            parent_id = getattr(obj, "folder_id", None)
            if parent_id and parent_id in folder_nodes:
                folder_nodes[parent_id]["children"].append(node)
            else:
                roots.append(node)

    return roots
