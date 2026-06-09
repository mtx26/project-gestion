from django.db import transaction

from rest_framework import serializers

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

    def get_permissions(self, role):
        return list(
            Permission.objects.filter(
                rolepermission__role=role,
                rolepermission__deleted_at__isnull=True,
            ).values("id", "code", "name", "description")
        )


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
    is_root = serializers.ReadOnlyField()

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
        ]


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


class InvitationSerializer(serializers.ModelSerializer):
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
    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "project",
            "folder",
            "task",
            "user",
            "duration_minutes",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
        ]


class FinancialEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialEntry
        fields = [
            "id",
            "project",
            "folder",
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
