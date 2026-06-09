from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from ..permissions import HasProjectPermission
from ..serializers import ProjectMemberSerializer
from ..services.members import get_project_members
from drf_spectacular.utils import extend_schema, extend_schema_view


@extend_schema_view(
    get=extend_schema(
        summary="Lister les membres d'un projet",
        description="Retourne tous les membres accessibles pour un projet donne.",
    ),
)
class ProjectMemberListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "member.view"
    serializer_class = ProjectMemberSerializer

    def get_queryset(self):
        return get_project_members(
            self.request.user,
            self.kwargs["project_id"],
        )
    
