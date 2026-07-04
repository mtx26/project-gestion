from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..authorization import OWNER_ONLY, HasProjectPermission, PermissionCodeByMethodMixin
from ..serializers import ProjectMemberSerializer, ProjectOwnerRateSerializer
from ..services.members import (
    authorize_member_update,
    build_owner_member_entry,
    detach_member_from_project,
    get_project_members,
    owner_matches_member_filters,
)
from ..services.projects import get_accessible_projects
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.views import APIView
from ..models import ProjectMember, ProjectOwnerRate


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
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        data = list(serializer.data)

        if self._should_show_synthetic_owner(project, request, page):
            data = [build_owner_member_entry(project)] + data

        if page is not None:
            return self.get_paginated_response(data)
        return Response(data)

    def _should_show_synthetic_owner(self, project, request, page):
        """Faut-il ajouter la ligne "propriétaire" fictive (`build_owner_member_entry`) ?

        Les 3 conditions doivent être vraies :
        - on est sur la première page (`paginate_queryset` s'exécute à chaque requête
          quelle que soit la page, donc les pages suivantes ne doivent pas la dupliquer) ;
        - le propriétaire n'a pas de vraie ligne `ProjectMember`, vérifié sur le
          queryset non filtré (une vraie ligne juste masquée par les filtres actifs ne
          doit pas être re-rajoutée en double) ;
        - les filtres actifs (`user`/`role`/`search`) le concernent bien.
        """
        is_first_page = page is None or self.paginator.page.number == 1
        owner_has_member_row = self.get_queryset().filter(user_id=project.owner_id).exists()
        return (
            is_first_page
            and not owner_has_member_row
            and owner_matches_member_filters(project, request)
        )


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
    serializer_class = ProjectOwnerRateSerializer
    permission_classes = [IsAuthenticated, HasProjectPermission]
    permission_code = OWNER_ONLY

    def patch(self, request, project_id):
        project = get_object_or_404(
            get_accessible_projects(request.user),
            pk=project_id,
        )
        serializer = ProjectOwnerRateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        rate, _ = ProjectOwnerRate.objects.get_or_create(
            project=project,
            defaults={"hourly_rate": 0},
        )
        rate.hourly_rate = serializer.validated_data["hourly_rate"]
        rate.save(update_fields=["hourly_rate"])
        return Response({"hourly_rate": str(rate.hourly_rate)})
