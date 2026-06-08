ERROR_CONTENT = {
    "application/json": {
        "schema": {
            "type": "object",
            "properties": {
                "detail": {"type": "string"},
            },
        },
    },
}


def add_error_responses(result, generator, request, public):
    authenticated_errors = {
        "401": {
            "description": "Authentification requise ou token invalide.",
            "content": ERROR_CONTENT,
        },
        "403": {
            "description": "Permission refusee.",
            "content": ERROR_CONTENT,
        },
    }
    validation_error = {
        "400": {
            "description": "Donnees invalides.",
            "content": ERROR_CONTENT,
        },
    }
    not_found_error = {
        "404": {
            "description": "Ressource introuvable ou inaccessible.",
            "content": ERROR_CONTENT,
        },
    }

    for path, path_item in result.get("paths", {}).items():
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue

            responses = operation.setdefault("responses", {})

            if operation.get("security"):
                responses.update({
                    code: response
                    for code, response in authenticated_errors.items()
                    if code not in responses
                })

            if method in {"post", "put", "patch"}:
                responses.update({
                    code: response
                    for code, response in validation_error.items()
                    if code not in responses
                })

            if "{" in path:
                responses.update({
                    code: response
                    for code, response in not_found_error.items()
                    if code not in responses
                })

    return result
