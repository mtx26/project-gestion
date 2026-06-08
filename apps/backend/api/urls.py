from django.urls import path
from .views.projects import (
    ProjectListCreateView,
    ProjectDetailView,
    ProjectRestoreView,
    ProjectTrashListView
)
    

urlpatterns = [
    path("projects/", ProjectListCreateView.as_view(), name="project-list-create"),
    path("projects/<int:pk>/", ProjectDetailView.as_view(), name="project-detail"),
    path("projects/trash/", ProjectTrashListView.as_view(), name="project-trash-list"),
    path("projects/<int:pk>/restore/", ProjectRestoreView.as_view(), name="project-restore"),
]