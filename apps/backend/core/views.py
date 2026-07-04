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
