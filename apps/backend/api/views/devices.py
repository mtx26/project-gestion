from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import UserDevice
from ..serializers import UserDeviceSerializer


@extend_schema(tags=["devices"])
class DeviceRegisterView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Enregistrer un device FCM",
        request=UserDeviceSerializer,
        responses={200: UserDeviceSerializer, 201: UserDeviceSerializer},
    )
    def post(self, request):
        serializer = UserDeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["fcm_token"]
        platform = serializer.validated_data.get("platform", UserDevice.Platform.WEB)

        device, created = UserDevice.objects.update_or_create(
            fcm_token=token,
            defaults={"user": request.user, "platform": platform, "is_active": True},
        )

        return Response(
            UserDeviceSerializer(device).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@extend_schema(tags=["devices"])
class DeviceUnregisterView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Désactiver un device FCM")
    def delete(self, request, fcm_token):
        updated = UserDevice.objects.filter(
            fcm_token=fcm_token,
            user=request.user,
        ).update(is_active=False)

        if not updated:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)
