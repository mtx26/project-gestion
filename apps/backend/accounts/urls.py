from django.urls import path

from .views import (
    CurrentUserProfilePictureView,
    CurrentUserDetailView,
    EmailVerificationConfirmView,
    GoogleLoginView,
    LoginView,
    LogoutView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetView,
    RefreshTokenView,
    RegisterView,
    ResendEmailVerificationView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("refresh/", RefreshTokenView.as_view(), name="token_refresh"),
    path("password/reset/", PasswordResetView.as_view(), name="password-reset"),
    path(
        "password/reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("password/change/", PasswordChangeView.as_view(), name="password-change"),
    path("email/verify/", EmailVerificationConfirmView.as_view(), name="email-verify"),
    path(
        "email/resend/",
        ResendEmailVerificationView.as_view(),
        name="email-resend",
    ),
    path("me/", CurrentUserDetailView.as_view(), name="me"),
    path("me/picture/", CurrentUserProfilePictureView.as_view(), name="me-picture"),
]
