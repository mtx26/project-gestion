from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..serializers import ProjectSerializer
from ..permissions import (
    CanEditProject,
    CanDeleteProject,
    CanRestoreProject,
)
from ..services.projects import (
    get_accessible_projects,
    get_accessible_deleted_projects,
)


class ProjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return get_accessible_projects(self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return get_accessible_projects(self.request.user)

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH"]:
            return [IsAuthenticated(), CanEditProject()]

        if self.request.method == "DELETE":
            return [IsAuthenticated(), CanDeleteProject()]

        return [IsAuthenticated()]

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)


class ProjectRestoreView(APIView):
    permission_classes = [IsAuthenticated, CanRestoreProject]

    def post(self, request, pk):
        project = get_object_or_404(
            get_accessible_deleted_projects(request.user),
            pk=pk
        )

        self.check_object_permissions(request, project)

        project.restore()

        serializer = ProjectSerializer(project)
        return Response(serializer.data)


class ProjectTrashListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return get_accessible_deleted_projects(self.request.user)