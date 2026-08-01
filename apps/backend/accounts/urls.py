from django.urls import path

from .views import (
    CurrentUserProfilePictureView,
    CurrentUserDetailView,
)

# L'inscription, la connexion, la deconnexion, la verification d'email, la
# reinitialisation de mot de passe et le login Google sont servis par
# django-allauth headless sous /_allauth/. Ne restent ici que les endpoints
# specifiques au projet (utilisateur courant + photo de profil).
urlpatterns = [
    path("me/", CurrentUserDetailView.as_view(), name="me"),
    path("me/picture/", CurrentUserProfilePictureView.as_view(), name="me-picture"),
]
