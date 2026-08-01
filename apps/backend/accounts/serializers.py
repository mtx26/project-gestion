from django.contrib.auth.models import User
from django.db import transaction

from rest_framework import serializers
from drf_spectacular.utils import OpenApiTypes, extend_schema_field
from allauth.account.models import EmailAddress

from .models import Profile

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["picture_url", "default_hourly_rate", "default_project"]
        read_only_fields = ["picture_url"]

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    email_verified = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "email_verified",
            "profile",
        ]

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_email_verified(self, user):
        return is_user_email_verified(user)


class CurrentUserUpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["default_hourly_rate", "default_project"]


class CurrentUserUpdateSerializer(serializers.ModelSerializer):
    profile = CurrentUserUpdateProfileSerializer(required=False)

    class Meta:
        model = User
        fields = ["username", "first_name", "last_name", "profile"]

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)

        with transaction.atomic():
            instance = super().update(instance, validated_data)

            if profile_data is not None:
                profile, _ = Profile.objects.get_or_create(user=instance)
                for field, value in profile_data.items():
                    setattr(profile, field, value)
                profile.save()
                instance.profile = profile

        return instance

    def to_representation(self, instance):
        return UserSerializer(instance).data


def is_user_email_verified(user):
    return EmailAddress.objects.filter(
        user=user,
        email__iexact=user.email,
        verified=True,
    ).exists()


@extend_schema_field(OpenApiTypes.BINARY)
class ProfilePictureUploadFileField(serializers.FileField):
    pass


class ProfilePictureUploadSerializer(serializers.Serializer):
    file = ProfilePictureUploadFileField()
