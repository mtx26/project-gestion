import logging

from rest_framework import generics
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view

from api.services.storage import (
    delete_profile_picture_file,
    get_profile_picture_file_id_from_url,
    upload_profile_picture_file,
)

from .models import Profile
from .serializers import (
    CurrentUserUpdateSerializer,
    ProfilePictureUploadSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


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
