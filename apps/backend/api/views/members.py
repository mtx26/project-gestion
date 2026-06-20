from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from ..permissions import HasProjectPermission
from ..serializers import ProjectMemberSerializer
from ..services.members import get_project_members
from ..services.projects import get_accessible_projects
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

    def list(self, request, *args, **kwargs):
        project = get_object_or_404(
            get_accessible_projects(request.user).select_related("owner__profile"),
            pk=self.kwargs["project_id"],
        )
        queryset = self.filter_queryset(self.get_queryset())
        owner_is_member = queryset.filter(user_id=project.owner_id).exists()

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            data = list(serializer.data)
            if not owner_is_member:
                data = [_build_owner_entry(project)] + data
            return self.get_paginated_response(data)

        serializer = self.get_serializer(queryset, many=True)
        data = list(serializer.data)
        if not owner_is_member:
            data = [_build_owner_entry(project)] + data
        return Response(data)


def _build_owner_entry(project):
    from ..utils import get_user_display_name
    display_name = get_user_display_name(project.owner)
    now = timezone.now().isoformat()
    try:
        picture_url = project.owner.profile.picture_url or None
    except AttributeError:
        picture_url = None
    return {
        "id": 0,
        "project": project.id,
        "user": project.owner_id,
        "user_display_name": display_name,
        "user_email": project.owner.email,
        "user_picture_url": picture_url,
        "role": 0,
        "role_name": "Proprietaire",
        "role_deleted": False,
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
        "deleted_by": None,
    }


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
        from ..models import Task, TimeEntry, FinancialEntry, ExpenseRequest
        user_id = instance.user_id
        project_id = instance.project_id

        Task.all_objects.filter(project_id=project_id, created_by_id=user_id).update(created_by=None)
        TimeEntry.all_objects.filter(project_id=project_id, user_id=user_id).update(user=None)
        FinancialEntry.all_objects.filter(project_id=project_id, created_by_id=user_id).update(created_by=None)
        ExpenseRequest.all_objects.filter(project_id=project_id, requested_by_id=user_id).update(requested_by=None)

        TaskUser = Task._meta.get_field("assigned_to").remote_field.through
        TaskUser.objects.filter(task__project_id=project_id, user_id=user_id).delete()

        instance.soft_delete(self.request.user)
