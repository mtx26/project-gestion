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
    "created_at",
    "updated_at",
    "deleted_at",
    "deleted_by",
]


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "owner",
        ]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = "__all__"
        read_only_fields = [
            "id",
            "name",
            "description",
            "code",
        ]


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS


class ProjectMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectMember
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS


class FolderSerializer(serializers.ModelSerializer):
    is_root = serializers.BooleanField(read_only=True)

    class Meta:
        model = Folder
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "is_root",
        ]


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "created_by",
        ]


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "invited_by",
            "token",
            "accepted_at",
        ]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "created_by",
        ]


class TimeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeEntry
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS


class FinancialEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialEntry
        fields = "__all__"
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "created_by",
        ]