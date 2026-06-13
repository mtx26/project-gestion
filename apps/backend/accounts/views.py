from rest_framework import generics, serializers
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer

from allauth.account.models import EmailAddress
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from django.conf import settings
from django.contrib.auth.models import User
from dj_rest_auth.registration.views import SocialLoginView

from api.services.storage import upload_profile_picture_file

from .models import Profile
from .serializers import (
    CurrentUserUpdateSerializer,
    EmailVerificationConfirmSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetSerializer,
    ProfilePictureUploadSerializer,
    RegisterSerializer,
    UserSerializer,
)


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Creer un compte",
        description="Cree un nouvel utilisateur et son profil.",
    ),
)
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    throttle_scope = "register"


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Se connecter",
        description="Retourne les tokens JWT d'acces et de rafraichissement.",
        responses={
            status.HTTP_200_OK: inline_serializer(
                name="LoginResponse",
                fields={
                    "access": serializers.CharField(),
                    "refresh": serializers.CharField(),
                    "user": UserSerializer(),
                },
            ),
        },
    ),
)
class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer
    throttle_scope = "login"


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Rafraichir le token",
        description="Retourne un nouveau token d'acces a partir du refresh token.",
    ),
)
class RefreshTokenView(TokenRefreshView):
    permission_classes = [AllowAny]


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Se deconnecter",
        description="Blackliste le refresh token fourni.",
        request=LogoutSerializer,
        responses={status.HTTP_204_NO_CONTENT: None},
    ),
)
class LogoutView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LogoutSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        description="Renvoie un email de verification pour l'utilisateur connecte.",
        responses={
            status.HTTP_200_OK: inline_serializer(
                name="ResendEmailVerificationResponse",
                fields={"detail": serializers.CharField()},
            ),
        },
    ),
)
class ResendEmailVerificationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        email_address, _ = EmailAddress.objects.get_or_create(
            user=request.user,
            email=request.user.email,
            defaults={"primary": True, "verified": False},
        )
        if email_address.verified:
            return Response({"detail": "messages.email.already_verified"})

        email_address.send_confirmation(request, signup=False)
        return Response({"detail": "messages.email.verification_sent"})


@extend_schema(tags=["user"])
@extend_schema_view(
    post=extend_schema(
        summary="Se connecter avec Google",
        description="Connecte ou cree un utilisateur via Google OAuth et retourne des tokens JWT.",
        request=inline_serializer(
            name="GoogleLoginRequest",
            fields={
                "code": serializers.CharField(required=False),
                "access_token": serializers.CharField(required=False),
                "id_token": serializers.CharField(required=False),
            },
        ),
        responses={
            status.HTTP_200_OK: inline_serializer(
                name="GoogleLoginResponse",
                fields={
                    "access": serializers.CharField(),
                    "refresh": serializers.CharField(),
                    "user": UserSerializer(),
                },
            ),
        },
    ),
)
class GoogleLoginView(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = settings.GOOGLE_OAUTH_CALLBACK_URL
    client_class = OAuth2Client

    def process_login(self):
        Profile.objects.get_or_create(user=self.user, defaults={"picture_url": ""})
        return super().process_login()


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

    def post(self, request):
        uploaded_file = request.FILES.get("file")

        if uploaded_file is None:
            return Response(
                {"file": ["errors.profile_picture.file_required"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        metadata = upload_profile_picture_file(uploaded_file, request.user.id)
        profile, _ = Profile.objects.get_or_create(user=request.user)
        profile.picture_url = metadata["url"]
        profile.save(update_fields=["picture_url", "updated_at"])
        request.user.profile = profile

        serializer = UserSerializer(request.user)
        return Response(serializer.data)
