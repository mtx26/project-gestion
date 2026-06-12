from decimal import Decimal

from django.contrib.auth.models import User
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist, ValidationError as DjangoValidationError
from django.utils import timezone

from rest_framework import serializers
from drf_spectacular.utils import OpenApiTypes, extend_schema_field

from .services.folders import build_folder_tree
from .services.invitations import (
    accept_project_invitation,
    create_project_invitation,
    normalize_invitation_email,
)
from .services.storage import get_document_download_url

from .models import (
    Project,
    Role,
    Permission,
    RolePermission,
    ProjectMember,
    Folder,
    Document,
    Task,
    Invitation,
    Notification,
    TimeEntry,
    FinancialEntry,
)


BASE_READ_ONLY_FIELDS = [
    "id",
    "created_at",
    "updated_at",
    "deleted_at",
    "deleted_by",
]


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "owner",
            "name",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "owner",
        ]


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = [
            "id",
            "name",
            "description",
            "code",
        ]
        read_only_fields = [
            "id",
            "name",
            "description",
            "code",
        ]


class RoleSerializer(serializers.ModelSerializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        many=True,
        required=False,
        write_only=True,
    )
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            "id",
            "project",
            "name",
            "description",
            "permissions",
            "permission_ids",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
        ]

    def create(self, validated_data):
        permissions = validated_data.pop("permission_ids", [])

        with transaction.atomic():
            role = Role.objects.create(**validated_data)
            self._set_permissions(role, permissions)

        return role

    def update(self, instance, validated_data):
        permissions = validated_data.pop("permission_ids", None)

        with transaction.atomic():
            role = super().update(instance, validated_data)

            if permissions is not None:
                self._set_permissions(role, permissions)

        return role

    def _set_permissions(self, role, permissions):
        RolePermission.objects.filter(role=role).delete()

        unique_permissions = {
            permission.id: permission
            for permission in permissions
        }.values()

        RolePermission.objects.bulk_create([
            RolePermission(role=role, permission=permission)
            for permission in unique_permissions
        ])

    @extend_schema_field(PermissionSerializer(many=True))
    def get_permissions(self, role):
        return list(
            Permission.objects.filter(
                rolepermission__role=role,
                rolepermission__deleted_at__isnull=True,
            ).values("id", "code", "name", "description")
        )


class ProjectMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectMember
        fields = [
            "id",
            "project",
            "user",
            "role",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
        ]


class FolderSerializer(serializers.ModelSerializer):
    is_root = serializers.BooleanField(read_only=True)

    class Meta:
        model = Folder
        fields = [
            "id",
            "project",
            "parent_folder",
            "name",
            "description",
            "color",
            "icon",
            "is_root",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "is_root",
        ]
        
    def create(self, validated_data):
        folder = Folder(**validated_data)
        try:
            folder.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        folder.save()
        return folder

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)

        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        instance.save()
        return instance


class FolderTreeNodeSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["folder", "document"])
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    color = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    icon = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    file_name = serializers.CharField(required=False)
    file_size = serializers.IntegerField(required=False)
    mime_type = serializers.CharField(required=False)
    children = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )


class FolderTreeSerializer(serializers.Serializer):
    def to_representation(self, instance):
        folders = instance["folders"]
        documents = instance["documents"]
        roots = build_folder_tree(folders, documents)
        return FolderTreeNodeSerializer(roots, many=True).data


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            "id",
            "project",
            "folder",
            "name",
            "description",
            "file_id",
            "file_name",
            "file_size",
            "mime_type",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "file_id",
            "file_name",
            "file_size",
            "mime_type",
        ]

    def create(self, validated_data):
        document = Document(**validated_data)
        try:
            document.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        document.save()
        return document

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)

        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        instance.save()
        return instance


@extend_schema_field(OpenApiTypes.BINARY)
class DocumentUploadFileField(serializers.FileField):
    pass


class DocumentUploadSerializer(serializers.Serializer):
    file = DocumentUploadFileField()
    folder = serializers.PrimaryKeyRelatedField(
        queryset=Folder.objects.all(),
        required=False,
        allow_null=True,
    )
    name = serializers.CharField(required=False)
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )


class DocumentDownloadSerializer(serializers.Serializer):
    url = serializers.URLField(read_only=True)
    file_name = serializers.CharField(read_only=True)
    mime_type = serializers.CharField(read_only=True)

    def to_representation(self, document):
        return {
            "url": get_document_download_url(document.file_id),
            "file_name": document.file_name,
            "mime_type": document.mime_type,
        }


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "id",
            "project",
            "folder",
            "created_by",
            "assigned_to",
            "title",
            "description",
            "status",
            "priority",
            "due_date",
            "completed_at",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "created_by",
        ]

    def create(self, validated_data):
        assigned_to = validated_data.pop("assigned_to", [])

        with transaction.atomic():
            task = Task(**validated_data)

            try:
                task.full_clean()
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict) from exc

            task.save()
            task.assigned_to.set(assigned_to)

            try:
                task.full_clean()
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict) from exc

        return task

    def update(self, instance, validated_data):
        assigned_to = validated_data.pop("assigned_to", None)

        with transaction.atomic():
            for field, value in validated_data.items():
                setattr(instance, field, value)

            try:
                instance.full_clean()
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict) from exc

            instance.save()

            if assigned_to is not None:
                instance.assigned_to.set(assigned_to)

            try:
                instance.full_clean()
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict) from exc

        return instance


class InvitationSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    user_exists = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = [
            "id",
            "project",
            "email",
            "role",
            "invited_by",
            "token",
            "expires_at",
            "accepted_at",
            "status",
            "user_exists",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "invited_by",
            "token",
            "accepted_at",
        ]

    @extend_schema_field(OpenApiTypes.STR)
    def get_status(self, invitation):
        if invitation.deleted_at:
            return "cancelled"

        if invitation.accepted_at:
            return "accepted"

        if invitation.expires_at <= timezone.now():
            return "expired"

        return "pending"

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_user_exists(self, invitation):
        return User.objects.filter(email__iexact=invitation.email).exists()


class InvitationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = [
            "email",
            "role",
        ]

    def validate_email(self, email):
        return normalize_invitation_email(email)

    def create(self, validated_data):
        try:
            return create_project_invitation(
                project=self.context["project"],
                email=validated_data["email"],
                role=validated_data["role"],
                invited_by=self.context["request"].user,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True)
    invitation = InvitationSerializer(read_only=True)
    member = ProjectMemberSerializer(read_only=True)

    def create(self, validated_data):
        try:
            invitation, member = accept_project_invitation(
                token=validated_data["token"],
                user=self.context["request"].user,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        return {
            "invitation": invitation,
            "member": member,
        }


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "user",
            "project",
            "created_by",
            "title",
            "message",
            "type",
            "data",
            "is_read",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "created_by",
        ]


class TimeEntrySerializer(serializers.ModelSerializer):
    cost_amount = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    is_paid = serializers.SerializerMethodField()

    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "project",
            "folder",
            "task",
            "user",
            "duration_minutes",
            "hourly_rate",
            "cost_amount",
            "paid_amount",
            "remaining_amount",
            "is_paid",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "cost_amount",
            "paid_amount",
            "remaining_amount",
            "is_paid",
        ]

    def create(self, validated_data):
        time_entry = TimeEntry(**validated_data)

        if "hourly_rate" not in validated_data:
            try:
                profile = time_entry.user.profile
            except ObjectDoesNotExist:
                profile = None

            if profile is not None:
                time_entry.hourly_rate = profile.default_hourly_rate

        try:
            time_entry.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        time_entry.save()
        return time_entry

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)

        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        instance.save()
        return instance

    @extend_schema_field(OpenApiTypes.STR)
    def get_cost_amount(self, time_entry):
        return self._money(self._get_cost_amount(time_entry))

    @extend_schema_field(OpenApiTypes.STR)
    def get_paid_amount(self, time_entry):
        return self._money(self._get_paid_amount(time_entry))

    @extend_schema_field(OpenApiTypes.STR)
    def get_remaining_amount(self, time_entry):
        remaining_amount = self._get_cost_amount(time_entry) - self._get_paid_amount(time_entry)
        return self._money(max(remaining_amount, Decimal("0.00")))

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_paid(self, time_entry):
        return self._get_paid_amount(time_entry) >= self._get_cost_amount(time_entry)

    def _get_cost_amount(self, time_entry):
        return Decimal(time_entry.duration_minutes) * time_entry.hourly_rate / Decimal("60")

    def _get_paid_amount(self, time_entry):
        financial_entries = getattr(time_entry, "financial_entries", None)
        if financial_entries is None:
            return Decimal("0.00")

        total = Decimal("0.00")
        for financial_entry in financial_entries.all():
            if financial_entry.type == FinancialEntry.FinancialType.EXPENSE:
                total += financial_entry.amount
            elif financial_entry.type == FinancialEntry.FinancialType.REFUND:
                total -= financial_entry.amount
        return max(total, Decimal("0.00"))

    def _money(self, value):
        return str(value.quantize(Decimal("0.01")))


class FinancialEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialEntry
        fields = [
            "id",
            "project",
            "folder",
            "document",
            "time_entry",
            "created_by",
            "amount",
            "type",
            "category",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "created_by",
        ]

    def create(self, validated_data):
        financial_entry = FinancialEntry(**validated_data)

        try:
            financial_entry.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        financial_entry.save()
        return financial_entry

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)

        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        instance.save()
        return instance
