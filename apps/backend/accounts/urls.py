from django.urls import path

from .views import CurrentUserView, LoginView, RefreshTokenView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshTokenView.as_view(), name="token_refresh"),
    path("me/", CurrentUserView.as_view(), name="me"),
]
