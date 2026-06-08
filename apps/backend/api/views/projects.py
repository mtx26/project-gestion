from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ...accounts.serializers import ProjectSerializer
from ...accounts.models import Project


class ProjectListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return Project.objects.filter(
            owner=self.request.user
        )
    
class ProjectCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
        
class ProjectDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return Project.objects.filter(
            owner=self.request.user
        )

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)
        
class ProjectRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            project = Project.all_objects.get(
                pk=pk,
                owner=request.user,
                deleted_at__isnull=False
            )
        except Project.DoesNotExist:
            return Response({"detail": "Project not found or not deleted."}, status=404)
        
        project.restore()
        project_serializer = ProjectSerializer(project)
        return Response(project_serializer.data)

class ProjectTrashListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return Project.all_objects.filter(
            owner=self.request.user,
            deleted_at__isnull=False
        )