from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from ..permissions import HasProjectPermission
from ..serializers import ProjectMemberSerializer
from ..services.members import get_project_members
from drf_spectacular.utils import extend_schema, extend_schema_view
from ..models import ProjectMember


@extend_schema(tags=["member"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les membres d'un projet",
        description=(
            "Retourne tous les membres accessibles pour un projet donne.\n\n"
            "- Filtres disponibles : `user`, `role`.\n\n"
            "- Recherche disponible : `search` sur `user__email`, `user__first_name`, "
            "`user__last_name`, `user__username` et `role__name`.\n\n"
            "- Pagination disponible : `page`.\n\n"
            "- Permission requise : `member.view`."
        ),
    ),
)
class ProjectMemberListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = "member.view"
    serializer_class = ProjectMemberSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["user", "role"]
    search_fields = [
        "user__email",
        "user__first_name",
        "user__last_name",
        "user__username",
        "role__name",
    ]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ProjectMember.objects.none()

        return get_project_members(
            self.request.user,
            self.kwargs["project_id"],
        )

@extend_schema(tags=["member"])
@extend_schema_view(
    patch=extend_schema(
        summary="Modifier un membre",
        description="Modifie le role d'un membre du projet.\nPermission requise : `member.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer un membre",
        description="Supprime un membre du projet.\nPermission requise : `member.edit`.",
    ),
)
class ProjectMemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectMemberSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]

    def get_permissions(self):
        if self.request.method == "GET":
            self.permission_code = "member.view"
        elif self.request.method in ["PUT", "PATCH", "DELETE"]:
            self.permission_code = "member.edit"

        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ProjectMember.objects.none()

        return get_project_members(
            self.request.user,
            self.kwargs["project_id"],
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project_id"] = self.kwargs["project_id"]
        return context

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)
