from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from drf_spectacular.utils import OpenApiTypes, extend_schema_field
from allauth.account.models import EmailAddress, get_emailconfirmation_model

from .models import Profile
from .services import send_password_reset_email

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["picture_url", "default_hourly_rate"]
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
        return EmailAddress.objects.filter(
            user=user,
            email__iexact=user.email,
            verified=True,
        ).exists()


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


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
            Profile.objects.get_or_create(user=user, defaults={"picture_url": ""})
            email_address, _ = EmailAddress.objects.get_or_create(
                user=user,
                email=user.email,
                defaults={"primary": True, "verified": False},
            )
            if not email_address.primary:
                email_address.set_as_primary()
            if not email_address.verified:
                request = self.context.get("request")
                email_address.send_confirmation(request, signup=True)

        return user


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate(self, attrs):
        self.token = attrs["refresh"]
        return attrs

    def save(self, **kwargs):
        try:
            RefreshToken(self.token).blacklist()
        except TokenError:
            raise serializers.ValidationError({"refresh": ["errors.token.invalid"]})


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self, **kwargs):
        email = self.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()

        if not user:
            return

        send_password_reset_email(user)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            self.user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({"token": ["errors.password_reset.invalid_token"]})

        if not default_token_generator.check_token(self.user, attrs["token"]):
            raise serializers.ValidationError({"token": ["errors.password_reset.invalid_token"]})

        validate_password(attrs["new_password"], self.user)
        return attrs

    def save(self, **kwargs):
        self.user.set_password(self.validated_data["new_password"])
        self.user.save(update_fields=["password"])


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, old_password):
        user = self.context["request"].user
        if not user.check_password(old_password):
            raise serializers.ValidationError("errors.password.invalid_current_password")
        return old_password

    def validate(self, attrs):
        validate_password(attrs["new_password"], self.context["request"].user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])


class EmailVerificationConfirmSerializer(serializers.Serializer):
    key = serializers.CharField()

    def validate(self, attrs):
        confirmation = get_emailconfirmation_model().from_key(attrs["key"])
        if not confirmation:
            raise serializers.ValidationError({"key": ["errors.email_verification.invalid_key"]})
        self.confirmation = confirmation
        return attrs

    def save(self, **kwargs):
        return self.confirmation.confirm(self.context["request"])


@extend_schema_field(OpenApiTypes.BINARY)
class ProfilePictureUploadFileField(serializers.FileField):
    pass


class ProfilePictureUploadSerializer(serializers.Serializer):
    file = ProfilePictureUploadFileField()
