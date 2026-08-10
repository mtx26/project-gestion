from django.urls import path

from .views import (
    CurrentUserProfilePictureView,
    CurrentUserDetailView,
    EmailVerificationConfirmView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetView,
    ResendEmailVerificationView,
)

urlpatterns = [
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
