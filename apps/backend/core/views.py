from rest_framework.response import Response


class SoftDeleteDestroyMixin:
    """DELETE soft-deletes the instance instead of removing the row."""

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)


class RestoreModelMixin:
    """POST restores a soft-deleted instance and returns it serialized."""

    def perform_restore(self, instance):
        instance.restore()

    def post(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_restore(instance)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class PermissionCodeByMethodMixin:
    """Sets `permission_code` for `HasProjectPermission` from a per-HTTP-method mapping.

    Declare `permission_codes_by_method = {"GET": "task.view", "POST": "task.edit"}`.
    A method not present in the mapping resolves to `None` (no fine-grained check beyond
    project access), matching the behavior of a manually written `get_permissions()`.
    """

    permission_codes_by_method: dict = {}

    def get_permissions(self):
        self.permission_code = self.permission_codes_by_method.get(self.request.method)
        return super().get_permissions()
