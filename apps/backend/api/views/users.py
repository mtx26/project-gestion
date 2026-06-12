from rest_framework import generics
from ..models import User
from accounts.serializers import UserSerializer
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.filters import SearchFilter


@extend_schema(tags=["users"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les utilisateurs",
        description=(
            "Retourne tous les utilisateurs.\n\n"
            "- Recherche disponible : `search` sur `email`, `first_name`, "
            "`last_name` et `username`.\n\n"
            "- Pagination disponible : `page`."
        ),
    ),
)
class UserListView(generics.ListAPIView):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer

    filter_backends = [SearchFilter]
    search_fields = ["email", "first_name", "last_name", "username"]
