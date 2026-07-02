from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics, serializers as drf_serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from ..permissions import HasProjectPermission
from ..serializers import ProjectMemberSerializer
from ..services.members import (
    authorize_member_update,
    detach_member_from_project,
    get_project_members,
)
from ..services.projects import get_accessible_projects
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.views import APIView
from ..models import ProjectMember, Project, ProjectOwnerRate
from core.views import PermissionCodeByMethodMixin


@extend_schema(tags=["member"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister les membres d'un projet",
        description=(
            "Retourne tous les membres d'un projet.\n\n"
            "- Filtres disponibles : `user`, `role`.\n\n"
            "- Recherche disponible : `search` sur l'email, le prénom, le nom de l'utilisateur et le nom du rôle.\n\n"
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
            get_accessible_projects(request.user).select_related("owner__profile", "owner_rate"),
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
    try:
        hourly_rate = str(project.owner_rate.hourly_rate)
    except ProjectOwnerRate.DoesNotExist:
        hourly_rate = "0.00"
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
        "hourly_rate": hourly_rate,
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
        "deleted_by": None,
    }


@extend_schema(tags=["member"])
@extend_schema_view(
    get=extend_schema(
        summary="Détail d'un membre",
        description="Retourne un membre précis d'un projet.\nPermission requise : `member.view`.",
    ),
    patch=extend_schema(
        summary="Modifier un membre",
        description="Modifie le rôle d'un membre du projet.\nPermission requise : `member.edit`.",
    ),
    delete=extend_schema(
        summary="Supprimer un membre",
        description="Supprime un membre du projet via soft delete.\nPermission requise : `member.edit`.",
    ),
)
class ProjectMemberDetailView(PermissionCodeByMethodMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectMemberSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    # PUT/PATCH resolve to no fixed code: the fine-grained check happens in
    # perform_update via authorize_member_update.
    permission_codes_by_method = {"GET": "member.view", "DELETE": "member.edit"}

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

    def perform_update(self, serializer):
        project = get_object_or_404(
            get_accessible_projects(self.request.user),
            pk=self.kwargs["project_id"],
        )
        authorize_member_update(self.request.user, project, serializer.instance, serializer.validated_data)
        serializer.save()

    def perform_destroy(self, instance):
        detach_member_from_project(instance)
        instance.soft_delete(self.request.user)


@extend_schema(tags=["member"])
@extend_schema_view(
    patch=extend_schema(
        summary="Modifier le taux horaire du proprietaire",
        description="Modifie le taux horaire du proprietaire pour ce projet. Reservé au proprietaire.",
    ),
)
class ProjectOwnerRateView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_project(self, request, project_id):
        project = get_object_or_404(
            get_accessible_projects(request.user),
            pk=project_id,
        )
        if project.owner_id != request.user.id:
            raise PermissionDenied("errors.project.not_owner")
        return project

    def patch(self, request, project_id):
        project = self._get_project(request, project_id)
        hourly_rate = request.data.get("hourly_rate")
        if hourly_rate is None:
            return Response(
                {"hourly_rate": ["errors.owner_rate.required"]},
                status=400,
            )
        rate, _ = ProjectOwnerRate.objects.get_or_create(
            project=project,
            defaults={"hourly_rate": 0},
        )
        rate.hourly_rate = hourly_rate
        rate.save(update_fields=["hourly_rate"])
        return Response({"hourly_rate": str(rate.hourly_rate)})
