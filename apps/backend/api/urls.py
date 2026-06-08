from django.urls import path
from .views import (
    ProjectListView,
    ProjectCreateView,
    ProjectDeleteView,
    ProjectRestoreView,
    ProjectTrashListView
)
    

urlpatterns = [
    path("projects/", ProjectListView.as_view(), name="project-list"),
    path("projects/create/", ProjectCreateView.as_view(), name="project-create"),
    path("projects/<int:pk>/delete/", ProjectDeleteView.as_view(), name="project-delete"),
    path("projects/<int:pk>/restore/", ProjectRestoreView.as_view(), name="project-restore"),
    path("projects/trash/", ProjectTrashListView.as_view(), name="project-trash-list"),
]