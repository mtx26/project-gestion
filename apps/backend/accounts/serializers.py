from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db import transaction

from rest_framework import serializers
from drf_spectacular.utils import OpenApiTypes, extend_schema_field

from .models import Profile

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["picture_url", "default_hourly_rate"]
        read_only_fields = ["picture_url"]

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "profile"]


class CurrentUserUpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["default_hourly_rate"]


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


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name"]

    def validate_password(self, password):
        validate_password(password)
        return password

    def validate_email(self, email):
        if email and User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("errors.user.email_already_exists")

        return email

    def create(self, validated_data):
        with transaction.atomic():
            user = User.objects.create_user(
                username=validated_data["username"],
                email=validated_data["email"],
                password=validated_data["password"],
                first_name=validated_data.get("first_name", ""),
                last_name=validated_data.get("last_name", ""),
            )
            Profile.objects.create(user=user, picture_url="")

        return user


@extend_schema_field(OpenApiTypes.BINARY)
class ProfilePictureUploadFileField(serializers.FileField):
    pass


class ProfilePictureUploadSerializer(serializers.Serializer):
    file = ProfilePictureUploadFileField()
