def group_nodes_by_folder(items, build_node):
    nodes_by_folder = {}
    root_nodes = []

    for item in items:
        node = build_node(item)
        folder_id = getattr(item, "folder_id", None)

        if folder_id:
            nodes_by_folder.setdefault(folder_id, []).append(node)
        else:
            root_nodes.append(node)

    return nodes_by_folder, root_nodes


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


def build_task_tree_nodes(tasks):
    return group_nodes_by_folder(tasks, build_task_tree_node)


def build_folder_tree(folders, documents=None, children_by_folder=None, root_children=None):
    folders = list(folders)
    documents = list(documents or [])
    children_by_folder = {
        folder_id: list(children)
        for folder_id, children in (children_by_folder or {}).items()
    }
    root_children = list(root_children or [])
    folder_nodes = {}

    for folder in folders:
        folder_nodes[folder.id] = {
            "type": "folder",
            "id": folder.id,
            "name": folder.name,
            "description": folder.description,
            "color": folder.color,
            "icon": folder.icon,
            "children": [],
        }

    roots = []

    for folder in folders:
        node = folder_nodes[folder.id]

        if folder.parent_folder_id and folder.parent_folder_id in folder_nodes:
            folder_nodes[folder.parent_folder_id]["children"].append(node)
        else:
            roots.append(node)

    document_nodes_by_folder, root_document_nodes = group_nodes_by_folder(
        documents,
        build_document_tree_node,
    )
    for folder_id, document_nodes in document_nodes_by_folder.items():
        children_by_folder.setdefault(folder_id, []).extend(document_nodes)

    for folder_id, children in children_by_folder.items():
        if folder_id in folder_nodes:
            folder_nodes[folder_id]["children"].extend(children)
        else:
            roots.extend(children)

    roots.extend(root_children)
    roots.extend(root_document_nodes)

    return roots
