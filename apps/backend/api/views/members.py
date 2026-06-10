from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from ..permissions import HasProjectPermission
from ..serializers import ProjectMemberSerializer
from ..services.members import get_project_members
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.permissions import IsAdminUser
from django.shortcuts import get_object_or_404
from ..models import ProjectMember
from ..services.projects import get_accessible_projects

@extend_schema(tags=["members"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les membres d'un projet",
        description="Retourne tous les membres accessibles pour un projet donne.\nPermission requise : `member.view`.",
    ),
)
class ProjectMemberListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "member.view"
    serializer_class = ProjectMemberSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ProjectMember.objects.none()

        return get_project_members(
            self.request.user,
            self.kwargs["project_id"],
        )
        
@extend_schema(tags=["members"])
class ProjectMemberAddView(generics.CreateAPIView):
    serializer_class = ProjectMemberSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def perform_create(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )

        serializer.save(project=project)
