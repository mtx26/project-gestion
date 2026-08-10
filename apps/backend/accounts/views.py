import logging

from rest_framework import generics, serializers
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer

from api.services.storage import (
    delete_profile_picture_file,
    get_profile_picture_file_id_from_url,
    upload_profile_picture_file,
)

from .models import Profile
from .serializers import (
    CurrentUserUpdateSerializer,
    EmailVerificationConfirmSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetSerializer,
    ProfilePictureUploadSerializer,
    ResendEmailVerificationSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Demander une reinitialisation du mot de passe",
        description="Envoie un email de reinitialisation si le compte existe.",
        request=PasswordResetSerializer,
        responses={
            status.HTTP_200_OK: inline_serializer(
                name="PasswordResetResponse",
                fields={"detail": serializers.CharField()},
            ),
        },
    ),
)
class PasswordResetView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = PasswordResetSerializer
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "messages.password_reset.email_sent"})


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Confirmer une reinitialisation du mot de passe",
        description="Definit un nouveau mot de passe avec uid et token.",
        request=PasswordResetConfirmSerializer,
        responses={
            status.HTTP_200_OK: inline_serializer(
                name="PasswordResetConfirmResponse",
                fields={"detail": serializers.CharField()},
            ),
        },
    ),
)
class PasswordResetConfirmView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = PasswordResetConfirmSerializer
    throttle_scope = "password_reset_confirm"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "messages.password_reset.password_updated"})


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Changer le mot de passe",
        description="Change le mot de passe de l'utilisateur connecte.",
        request=PasswordChangeSerializer,
        responses={
            status.HTTP_200_OK: inline_serializer(
                name="PasswordChangeResponse",
                fields={"detail": serializers.CharField()},
            ),
        },
    ),
)
class PasswordChangeView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PasswordChangeSerializer
    throttle_scope = "password_change"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "messages.password.changed"})


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Verifier l'email",
        description="Confirme une adresse email a partir de la cle envoyee par email.",
        request=EmailVerificationConfirmSerializer,
        responses={
            status.HTTP_200_OK: inline_serializer(
                name="EmailVerificationResponse",
                fields={"detail": serializers.CharField()},
            ),
        },
    ),
)
class EmailVerificationConfirmView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = EmailVerificationConfirmSerializer
    throttle_scope = "email_verify"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_address = serializer.save()
        if not email_address:
            return Response(
                {"key": ["errors.email_verification.invalid_key"]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"detail": "messages.email.verified"})


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Renvoyer l'email de verification",
        description="Renvoie un email de verification si le compte existe et n'est pas verifie.",
        request=ResendEmailVerificationSerializer,
        responses={
            status.HTTP_200_OK: inline_serializer(
                name="ResendEmailVerificationResponse",
                fields={"detail": serializers.CharField()},
            ),
        },
    ),
)
class ResendEmailVerificationView(APIView):
    permission_classes = [AllowAny]
    serializer_class = ResendEmailVerificationSerializer
    throttle_scope = "email_resend"

    def post(self, request):
        serializer = self.serializer_class(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "messages.email.verification_sent_if_account_exists"})


@extend_schema(tags=["user"])
@extend_schema_view(
    get=extend_schema(
        summary="Recuperer l'utilisateur courant",
        description="Retourne les informations de l'utilisateur connecte.",
    ),
    put=extend_schema(
        summary="Modifier l'utilisateur courant",
        description="Met a jour les informations modifiables de l'utilisateur connecte.",
        request=CurrentUserUpdateSerializer,
        responses={status.HTTP_200_OK: UserSerializer},
    ),
    patch=extend_schema(
        summary="Modifier partiellement l'utilisateur courant",
        description="Met a jour partiellement les informations modifiables de l'utilisateur connecte.",
        request=CurrentUserUpdateSerializer,
        responses={status.HTTP_200_OK: UserSerializer},
    ),
)
class CurrentUserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return CurrentUserUpdateSerializer

        return UserSerializer


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Modifier la photo de profil",
        description="Upload une image dans MinIO et met a jour l'URL de photo du profil connecte.",
        request=ProfilePictureUploadSerializer,
        responses={status.HTTP_200_OK: UserSerializer},
    ),
)
class CurrentUserProfilePictureView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]
    serializer_class = ProfilePictureUploadSerializer
    throttle_scope = "profile_picture"

    def post(self, request):
        uploaded_file = request.FILES.get("file")

        if uploaded_file is None:
            return Response(
                {"file": ["errors.profile_picture.file_required"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile, _ = Profile.objects.get_or_create(user=request.user)
        previous_picture_url = profile.picture_url

        metadata = upload_profile_picture_file(uploaded_file, request.user.id)
        profile.picture_url = metadata["url"]
        profile.save(update_fields=["picture_url", "updated_at"])
        request.user.profile = profile
        self.delete_previous_picture(previous_picture_url, request.user.id, metadata["file_id"])

        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def delete_previous_picture(self, previous_picture_url, user_id, current_file_id):
        previous_file_id = get_profile_picture_file_id_from_url(previous_picture_url, user_id)
        if not previous_file_id or previous_file_id == current_file_id:
            return

        try:
            delete_profile_picture_file(previous_file_id)
        except Exception:
            logger.warning("Could not delete previous profile picture %s", previous_file_id, exc_info=True)
