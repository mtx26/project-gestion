from rest_framework import generics
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.utils import extend_schema, extend_schema_view

from django.contrib.auth.models import User

from api.services.storage import upload_profile_picture_file

from .models import Profile
from .serializers import (
    ProfilePictureUploadSerializer,
    RegisterSerializer,
    UserSerializer,
)


@extend_schema(tags=["accounts"])
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


@extend_schema(tags=["accounts"])
@extend_schema_view(
    post=extend_schema(
        summary="Se connecter",
        description="Retourne les tokens JWT d'acces et de rafraichissement.",
    ),
)
class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]


@extend_schema(tags=["accounts"])
@extend_schema_view(
    post=extend_schema(
        summary="Rafraichir le token",
        description="Retourne un nouveau token d'acces a partir du refresh token.",
    ),
)
class RefreshTokenView(TokenRefreshView):
    permission_classes = [AllowAny]


@extend_schema(tags=["accounts"])
@extend_schema_view(
    get=extend_schema(
        summary="Recuperer l'utilisateur courant",
        description="Retourne les informations de l'utilisateur connecte.",
    ),
)
class CurrentUserView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


@extend_schema(tags=["accounts"])
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
