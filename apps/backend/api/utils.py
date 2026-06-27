from rest_framework.filters import OrderingFilter


class StableOrderingFilter(OrderingFilter):
    def filter_queryset(self, request, queryset, view):
        ordering = self.get_ordering(request, queryset, view)
        if ordering:
            return queryset.order_by(*ordering, "id")
        return queryset


try:
    from drf_spectacular.extensions import OpenApiFilterExtension

    class _StableOrderingFilterExtension(OpenApiFilterExtension):
        target_class = "api.utils.StableOrderingFilter"

        def get_schema_operation_parameters(self, auto_schema, *args, **kwargs):
            ordering_fields = getattr(auto_schema.view, "ordering_fields", None) or []
            if ordering_fields == "__all__":
                return self.target.get_schema_operation_parameters(auto_schema.view)
            enum = [v for field in ordering_fields for v in (field, f"-{field}")]
            return [{
                "name": self.target.ordering_param,
                "required": False,
                "in": "query",
                "description": "Champ de tri. Préfixer avec `-` pour ordre descendant.",
                "schema": {"type": "string", "enum": enum},
            }]

except ImportError:
    pass


def get_user_display_name(user):
    """Return the best human-readable name for a User instance."""
    if user is None:
        return None
    full_name = (user.get_full_name() or "").strip()
    return full_name or user.username or user.email
