from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.utils import extend_schema, extend_schema_view

from django.contrib.auth.models import User

from .serializers import RegisterSerializer, UserSerializer


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
