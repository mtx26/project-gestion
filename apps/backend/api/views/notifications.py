import django_filters
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Notification
from ..serializers import NotificationSerializer


class NotificationFilter(django_filters.FilterSet):
    unread = django_filters.BooleanFilter(method="filter_unread")

    class Meta:
        model = Notification
        fields = []

    def filter_unread(self, queryset, name, value):
        if value:
            return queryset.filter(is_read=False)
        return queryset


@extend_schema(tags=["notifications"])
@extend_schema_view(
    get=extend_schema(
        summary="Lister mes notifications",
        description=(
            "Retourne les notifications de l'utilisateur connecté, triées par statut de lecture puis par date.\n\n"
            "- Filtres disponibles : `unread=true` — retourne uniquement les notifications non lues.\n\n"
            "- Recherche disponible : `search` sur `title` et `message`.\n\n"
            "- Pagination disponible : `page`."
        ),
    ),
)
class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = NotificationFilter
    search_fields = ["title", "message"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()

        return (
            Notification.objects.select_related("project", "created_by")
            .filter(user=self.request.user)
            .order_by("is_read", "-created_at", "-id")
        )


@extend_schema(tags=["notifications"])
class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Compter mes notifications non lues")
    def get(self, request):
        count = Notification.objects.filter(
            user=request.user,
            is_read=False,
        ).count()
        return Response({"count": count})


@extend_schema(tags=["notifications"])
class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Marquer une notification comme lue")
    def post(self, request, pk):
        updated = Notification.objects.filter(
            pk=pk,
            user=request.user,
        ).update(is_read=True)

        if not updated:
            return Response(status=status.HTTP_404_NOT_FOUND)

        notification = Notification.objects.select_related("project", "created_by").get(pk=pk)
        return Response(NotificationSerializer(notification).data)


@extend_schema(tags=["notifications"])
class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Marquer toutes mes notifications comme lues")
    def post(self, request):
        Notification.objects.filter(
            user=request.user,
            is_read=False,
        ).update(is_read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)
