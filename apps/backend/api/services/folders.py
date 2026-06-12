def build_folder_tree(folders, documents):
    folders = list(folders)
    documents = list(documents)
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

    for document in documents:
        node = {
            "type": "document",
            "id": document.id,
            "name": document.name,
            "description": document.description,
            "file_name": document.file_name,
            "file_size": document.file_size,
            "mime_type": document.mime_type,
        }

        if document.folder_id and document.folder_id in folder_nodes:
            folder_nodes[document.folder_id]["children"].append(node)
        else:
            roots.append(node)

    return roots
