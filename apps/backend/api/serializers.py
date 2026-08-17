from decimal import Decimal

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from rest_framework import serializers
from drf_spectacular.utils import OpenApiTypes, extend_schema_field

from .authorization import ProjectAuthorization, ProjectAuthorizationMap
from .services.roles import (
    expand_permissions,
    get_role_permissions_map,
)
from .services.invitations import (
    accept_project_invitation,
    create_project_invitation,
    normalize_invitation_email,
)
from .services.financial_entries import FINANCIAL_ENTRY_SOURCES, financial_entry_source
from .services.storage import get_document_download_url
from .utils import get_user_display_name

from .models import (
    Project,
    Role,
    Permission,
    RolePermission,
    ProjectMember,
    ProjectOwnerRate,
    Folder,
    Document,
    Task,
    Invitation,
    Notification,
    TimeEntry,
    FinancialEntry,
    ExpenseRequest,
    ProjectCalendarSubscription,
)


BASE_READ_ONLY_FIELDS = [
    "id",
    "created_at",
    "updated_at",
    "deleted_at",
    "deleted_by",
]


class ProjectListSerializer(serializers.ListSerializer):
    """Precomputes permission codes for the whole page in one batch (see
    `ProjectAuthorizationMap`) instead of once per project."""

    def to_representation(self, data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        self.context["permission_map"] = ProjectAuthorizationMap(user, data)
        return super().to_representation(data)


class ProjectSerializer(serializers.ModelSerializer):
    owner_display_name = serializers.SerializerMethodField()
    current_user_permission_codes = serializers.SerializerMethodField()

    class Meta:
        model = Project
        list_serializer_class = ProjectListSerializer
        fields = [
            "id",
            "owner",
            "owner_display_name",
            "current_user_permission_codes",
            "name",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "owner",
            "owner_display_name",
            "current_user_permission_codes",
        ]

    def get_owner_display_name(self, project):
        return get_user_display_name(project.owner)

    def get_current_user_permission_codes(self, project):
        permission_map = self.context.get("permission_map")
        if permission_map is not None:
            return permission_map.codes_for(project)

        request = self.context.get("request")
        user = getattr(request, "user", None)
        return ProjectAuthorization(user, project).codes()


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


class RoleListSerializer(serializers.ListSerializer):
    """Precomputes permissions for the whole page in one batch (see
    `get_role_permissions_map`) instead of once per role."""

    def to_representation(self, data):
        self.context["permissions_by_role"] = get_role_permissions_map(data)
        return super().to_representation(data)


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
        list_serializer_class = RoleListSerializer
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
        request = self.context.get("request")
        deleted_by = request.user if request else None
        RolePermission.objects.filter(role=role).update(
            deleted_at=timezone.now(), deleted_by=deleted_by,
        )

        unique_permissions = {
            permission.id: permission
            for permission in expand_permissions(permissions)
        }.values()

        RolePermission.objects.bulk_create([
            RolePermission(role=role, permission=permission)
            for permission in unique_permissions
        ])

    @extend_schema_field(PermissionSerializer(many=True))
    def get_permissions(self, role):
        permissions_by_role = self.context.get("permissions_by_role")
        if permissions_by_role is not None:
            return permissions_by_role.get(role.id, [])

        return list(
            Permission.objects.filter(
                rolepermission__role=role,
                rolepermission__deleted_at__isnull=True,
            ).values("id", "code", "name", "description")
        )


class ProjectOwnerRateSerializer(serializers.Serializer):
    hourly_rate = serializers.DecimalField(max_digits=10, decimal_places=2)


class ProjectMemberSerializer(serializers.ModelSerializer):
    user_display_name = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_picture_url = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()
    role_deleted = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMember
        fields = [
            "id",
            "project",
            "user",
            "user_display_name",
            "user_email",
            "user_picture_url",
            "role",
            "role_name",
            "role_deleted",
            "hourly_rate",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "user_display_name",
            "user_email",
            "user_picture_url",
            "role_name",
            "role_deleted",
        ]

    def get_user_display_name(self, member):
        return get_user_display_name(member.user)

    def get_user_picture_url(self, member):
        try:
            return member.user.profile.picture_url or None
        except AttributeError:
            return None

    def get_role_name(self, member):
        if member.role.deleted_at is not None:
            return None

        return member.role.name

    def get_role_deleted(self, member):
        return member.role.deleted_at is not None

    def validate_role(self, role):
        project_id = self.context.get("project_id")
        if project_id is None and self.instance is not None:
            project_id = self.instance.project_id

        if project_id is not None and role.project_id != project_id:
            raise serializers.ValidationError("errors.project_member.role_project_mismatch")

        return role


class FolderSerializer(serializers.ModelSerializer):
    is_root = serializers.BooleanField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Folder
        fields = [
            "id",
            "project",
            "parent_folder",
            "created_by",
            "created_by_name",
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
            "created_by",
            "is_root",
        ]

    def get_created_by_name(self, obj):
        return get_user_display_name(obj.created_by)
        
    def create(self, validated_data):
        folder = Folder(**validated_data)
        folder.full_clean()
        folder.save()
        return folder

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.full_clean()
        instance.save()
        return instance


def _build_document_tree_node(document):
    return {
        "type": "document",
        "id": document.id,
        "name": document.name,
        "description": document.description,
        "file_name": document.file_name,
        "file_size": document.file_size,
        "mime_type": document.mime_type,
    }


def _build_task_tree_node(task):
    return {
        "type": "task",
        "id": task.id,
        "name": task.title,
        "description": task.description,
        "folder": task.folder_id,
        "status": task.status,
        "priority": task.priority,
        "end_date": task.end_date.isoformat() if task.end_date else None,
    }


def build_folder_tree(folders, documents=None, tasks=None):
    """Transforms flat `folders`/`documents`/`tasks` querysets into the nested tree
    structure `FolderTreeNodeSerializer` expects. Pure data reshaping (no DB access,
    no business rule), so it lives with the serializers rather than in a service."""
    folder_nodes = {}
    roots = []

    for folder in folders:
        created_by_name = get_user_display_name(getattr(folder, "created_by", None))
        folder_nodes[folder.id] = {
            "type": "folder",
            "id": folder.id,
            "name": folder.name,
            "description": folder.description,
            "color": folder.color,
            "icon": folder.icon,
            "created_by_name": created_by_name,
            "children": [],
        }

    for folder in folders:
        node = folder_nodes[folder.id]
        parent_id = folder.parent_folder_id
        if parent_id and parent_id in folder_nodes:
            folder_nodes[parent_id]["children"].append(node)
        else:
            roots.append(node)

    for items, build_fn in [
        (tasks or [], _build_task_tree_node),
        (documents or [], _build_document_tree_node),
    ]:
        for obj in items:
            node = build_fn(obj)
            parent_id = getattr(obj, "folder_id", None)
            if parent_id and parent_id in folder_nodes:
                folder_nodes[parent_id]["children"].append(node)
            else:
                roots.append(node)

    return roots


class FolderTreeNodeSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["folder", "document", "task"])
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    color = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    icon = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    folder = serializers.IntegerField(allow_null=True, required=False)
    status = serializers.CharField(required=False)
    priority = serializers.CharField(required=False)
    end_date = serializers.CharField(allow_null=True, required=False)
    file_name = serializers.CharField(required=False)
    file_size = serializers.IntegerField(required=False)
    mime_type = serializers.CharField(required=False)
    created_by_name = serializers.CharField(allow_null=True, required=False)
    children = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )


class FolderTreeQuerySerializer(serializers.Serializer):
    include_files = serializers.BooleanField(required=False, default=True)
    include_tasks = serializers.BooleanField(required=False, default=False)


class FolderTreeSerializer(serializers.Serializer):
    def to_representation(self, instance):
        roots = build_folder_tree(
            instance["folders"],
            instance["documents"],
            instance.get("tasks"),
        )
        return FolderTreeNodeSerializer(roots, many=True).data


class FolderTargetTreeSerializer(serializers.Serializer):
    def to_representation(self, instance):
        roots = build_folder_tree(
            instance["folders"],
            tasks=instance.get("tasks"),
        )
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
        document.full_clean()
        document.save()
        return document

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.full_clean()
        instance.save()
        return instance


@extend_schema_field(OpenApiTypes.BINARY)
class DocumentUploadFileField(serializers.FileField):
    default_error_messages = {
        "required": "errors.document.file_required",
        "no_file": "errors.document.file_required",
    }


class DocumentUploadSerializer(serializers.Serializer):
    file = DocumentUploadFileField()
    folder = serializers.PrimaryKeyRelatedField(
        queryset=Folder.objects.all(),
        required=False,
        allow_null=True,
        error_messages={"does_not_exist": "errors.document.folder_not_found"},
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


class DocumentDownloadBatchRequestSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False, max_length=100)


class DocumentDownloadBatchItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    url = serializers.URLField(read_only=True)
    file_name = serializers.CharField(read_only=True)
    mime_type = serializers.CharField(read_only=True)

    def to_representation(self, document):
        return {
            "id": document.id,
            "url": get_document_download_url(document.file_id),
            "file_name": document.file_name,
            "mime_type": document.mime_type,
        }


class TaskSerializer(serializers.ModelSerializer):
    folder_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    assigned_to_display_names = serializers.SerializerMethodField()
    documents_info = serializers.SerializerMethodField()
    documents = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Document.objects.all(), required=False, write_only=True,
    )

    class Meta:
        model = Task
        fields = [
            "id",
            "project",
            "folder",
            "folder_name",
            "created_by",
            "created_by_name",
            "assigned_to",
            "assigned_to_display_names",
            "title",
            "description",
            "status",
            "priority",
            "start_date",
            "end_date",
            "completed_at",
            "documents",
            "documents_info",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "created_by",
            "folder_name",
            "created_by_name",
            "assigned_to_display_names",
            "documents_info",
        ]

    def get_folder_name(self, obj):
        return obj.folder.name if obj.folder_id else None

    def get_created_by_name(self, obj):
        return get_user_display_name(obj.created_by)

    def get_assigned_to_display_names(self, obj):
        return [get_user_display_name(u) for u in obj.assigned_to.all()]

    def get_documents_info(self, obj):
        return [
            {"id": doc.id, "name": doc.file_name, "mime_type": doc.mime_type, "file_size": doc.file_size}
            for doc in obj.documents.all()
        ]

    def validate_assigned_to(self, value):
        from .services.members import get_project_assignable_users
        project = self.context.get("project")
        if project is None:
            return value
        assignable_ids = set(get_project_assignable_users(project).values_list("pk", flat=True))
        for user in value:
            if user.pk not in assignable_ids:
                raise serializers.ValidationError("errors.task.assigned_user_not_project_member")
        return value

    def create(self, validated_data):
        assigned_to = validated_data.pop("assigned_to", [])
        documents = validated_data.pop("documents", [])

        with transaction.atomic():
            task = Task(**validated_data)
            task.full_clean()
            task.save()
            task.assigned_to.set(assigned_to)
            if documents:
                task.documents.set(documents)

        return task

    def update(self, instance, validated_data):
        assigned_to = validated_data.pop("assigned_to", None)
        documents = validated_data.pop("documents", None)

        new_status = validated_data.get("status")
        if new_status == "done" and instance.status != "done":
            validated_data.setdefault("completed_at", timezone.now())
        elif new_status and new_status != "done" and instance.status == "done":
            validated_data["completed_at"] = None

        with transaction.atomic():
            for field, value in validated_data.items():
                setattr(instance, field, value)

            instance.full_clean()
            instance.save()

            if assigned_to is not None:
                instance.assigned_to.set(assigned_to)

            if documents is not None:
                instance.documents.set(documents)

        return instance


class InvitationSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    user_exists = serializers.SerializerMethodField()
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = Invitation
        fields = [
            "id",
            "project",
            "email",
            "role",
            "role_name",
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

    def validate_role(self, role):
        project_id = self.context.get("project_id")
        if project_id is None and self.instance is not None:
            project_id = self.instance.project_id

        if project_id is not None and role.project_id != project_id:
            raise serializers.ValidationError("errors.invitation.role_project_mismatch")

        return role

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
        return create_project_invitation(
            project=self.context["project"],
            email=validated_data["email"],
            role=validated_data["role"],
            invited_by=self.context["request"].user,
        )


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True)
    invitation = InvitationSerializer(read_only=True)
    member = ProjectMemberSerializer(read_only=True)

    def create(self, validated_data):
        invitation, member = accept_project_invitation(
            token=validated_data["token"],
            user=self.context["request"].user,
        )

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
    folder_name = serializers.SerializerMethodField()
    task_name = serializers.SerializerMethodField()
    user_display_name = serializers.SerializerMethodField()
    documents_info = serializers.SerializerMethodField()
    documents = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Document.objects.all(), required=False, write_only=True,
    )

    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "project",
            "folder",
            "folder_name",
            "task",
            "task_name",
            "user",
            "user_display_name",
            "title",
            "start_date",
            "duration_minutes",
            "hourly_rate",
            "cost_amount",
            "paid_amount",
            "remaining_amount",
            "documents",
            "documents_info",
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
            "folder_name",
            "task_name",
            "user_display_name",
            "documents_info",
        ]

    def validate_user(self, user):
        from .services.members import get_project_assignable_users

        # Une entree deja attribuee ne change pas de titulaire : ses heures sont
        # potentiellement deja payees a quelqu'un. Seules les entrees orphelines
        # (`user` a NULL, laissees par un compte supprime) peuvent etre attribuees.
        if self.instance is not None and self.instance.user_id is not None:
            if getattr(user, "pk", None) != self.instance.user_id:
                raise serializers.ValidationError("errors.time_entry.user_already_assigned")

        project = self.context.get("project")
        if project is None or user is None:
            return user
        if not get_project_assignable_users(project).filter(pk=user.pk).exists():
            raise serializers.ValidationError("errors.time_entry.user_not_project_member")
        return user

    def get_folder_name(self, obj):
        return obj.folder.name if obj.folder_id else None

    def get_task_name(self, obj):
        return obj.task.title if obj.task_id else None

    def get_user_display_name(self, obj):
        return get_user_display_name(obj.user)

    def get_documents_info(self, obj):
        return [
            {"id": doc.id, "name": doc.file_name, "mime_type": doc.mime_type, "file_size": doc.file_size}
            for doc in obj.documents.all()
        ]

    def create(self, validated_data):
        documents = validated_data.pop("documents", [])
        time_entry = TimeEntry(**validated_data)

        # Meme regle que le backfill des entrees existantes (migration 0059) : une entree
        # rattachee a une tache herite de son titre tant qu'on ne lui en donne pas un.
        if not time_entry.title and time_entry.task_id:
            time_entry.title = time_entry.task.title

        if "hourly_rate" not in validated_data and time_entry.user_id:
            member = ProjectMember.objects.filter(
                project_id=time_entry.project_id,
                user_id=time_entry.user_id,
            ).first()
            if member is not None:
                time_entry.hourly_rate = member.hourly_rate
            else:
                owner_rate = ProjectOwnerRate.objects.filter(
                    project_id=time_entry.project_id,
                ).first()
                if owner_rate is not None:
                    time_entry.hourly_rate = owner_rate.hourly_rate

        time_entry.full_clean()

        time_entry.save()
        if documents:
            time_entry.documents.set(documents)
        return time_entry

    def update(self, instance, validated_data):
        documents = validated_data.pop("documents", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.full_clean()

        instance.save()
        if documents is not None:
            instance.documents.set(documents)
        return instance

    @extend_schema_field(OpenApiTypes.STR)
    def get_cost_amount(self, time_entry):
        return self._money(time_entry.get_cost_amount())

    @extend_schema_field(OpenApiTypes.STR)
    def get_paid_amount(self, time_entry):
        return self._money(time_entry.get_paid_amount())

    @extend_schema_field(OpenApiTypes.STR)
    def get_remaining_amount(self, time_entry):
        return self._money(time_entry.get_remaining_amount())

    def _money(self, value):
        return str(value.quantize(Decimal("0.01")))


class DayEntryPersonSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    hourly_rate = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)


class DayEntryCreateSerializer(serializers.Serializer):
    """Cree une tache deja terminee et une TimeEntry par personne en une seule
    action (bouton "Nouvelle entree de journee") : voir `services.day_entries.
    create_day_entry`, qui fait le travail reel dans une transaction. Toutes les
    personnes listees partagent le meme `start_date`/`end_date` (donc la meme
    duree) ; seul `hourly_rate` varie par personne."""

    title = serializers.CharField(max_length=255, write_only=True)
    description = serializers.CharField(required=False, allow_blank=True, write_only=True)
    folder = serializers.PrimaryKeyRelatedField(
        queryset=Folder.objects.all(), required=False, allow_null=True, write_only=True,
    )
    priority = serializers.ChoiceField(choices=Task.Priority.choices, required=False, write_only=True)
    start_date = serializers.DateTimeField(write_only=True)
    end_date = serializers.DateTimeField(write_only=True)
    documents = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Document.objects.all(), required=False, write_only=True,
    )
    entries = DayEntryPersonSerializer(many=True, write_only=True)
    task = TaskSerializer(read_only=True)
    time_entries = TimeEntrySerializer(many=True, read_only=True)

    def validate_entries(self, value):
        if not value:
            raise serializers.ValidationError("errors.day_entry.entries_required")
        return value

    def validate(self, attrs):
        if attrs["end_date"] <= attrs["start_date"]:
            raise serializers.ValidationError({
                "end_date": "errors.day_entry.end_date_before_start_date"
            })
        return attrs

    def create(self, validated_data):
        from .services.day_entries import create_day_entry

        project = self.context["project"]
        actor = self.context["request"].user
        return create_day_entry(project=project, actor=actor, **validated_data)


class TimeEntryPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
    )
    pay_full = serializers.BooleanField(required=False, default=False)
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    financial_entry = serializers.SerializerMethodField(read_only=True)
    time_entry = TimeEntrySerializer(read_only=True)

    def validate(self, attrs):
        time_entry = self.context["time_entry"]
        remaining_amount = time_entry.get_remaining_amount()

        if remaining_amount <= Decimal("0.00"):
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.already_paid"
            })

        amount = remaining_amount if attrs.get("pay_full") else attrs.get("amount")
        if amount is None:
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.amount_required"
            })

        if amount <= Decimal("0.00"):
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.amount_must_be_positive"
            })

        if amount > remaining_amount:
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.amount_exceeds_remaining"
            })

        attrs["amount"] = amount
        return attrs

    def create(self, validated_data):
        time_entry = self.context["time_entry"]
        request = self.context["request"]
        description = validated_data.get("description") or None

        financial_entry = FinancialEntry.objects.create(
            project=time_entry.project,
            time_entry=time_entry,
            created_by=request.user,
            amount=validated_data["amount"],
            type=FinancialEntry.FinancialType.EXPENSE,
            description=description,
        )

        return {
            "financial_entry": financial_entry,
            "time_entry": time_entry,
        }

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_financial_entry(self, payment):
        return FinancialEntrySerializer(payment["financial_entry"]).data


class TimeEntryPaymentCorrectionSerializer(serializers.Serializer):
    """Corrige le montant total payé sur une entrée de temps.

    Ne modifie aucune entrée financière existante : crée une nouvelle entrée de
    correction (dépense si le nouveau montant est supérieur au montant payé actuel,
    remboursement s'il est inférieur), pour garder un historique complet.
    """

    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    financial_entry = serializers.SerializerMethodField(read_only=True)
    time_entry = TimeEntrySerializer(read_only=True)

    def validate(self, attrs):
        amount = attrs.get("amount")
        if amount is None:
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.amount_required"
            })

        if amount < Decimal("0.00"):
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.amount_must_be_positive"
            })

        time_entry = self.context["time_entry"]
        cost_amount = time_entry.get_cost_amount()

        if amount > cost_amount:
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.amount_exceeds_remaining"
            })

        delta = amount - time_entry.get_paid_amount()
        if delta == Decimal("0.00"):
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.amount_unchanged"
            })

        attrs["amount"] = amount
        attrs["delta"] = delta
        return attrs

    def create(self, validated_data):
        time_entry = self.context["time_entry"]
        request = self.context["request"]
        delta = validated_data["delta"]

        financial_entry = FinancialEntry.objects.create(
            project=time_entry.project,
            time_entry=time_entry,
            created_by=request.user,
            amount=abs(delta),
            type=FinancialEntry.FinancialType.EXPENSE if delta > 0 else FinancialEntry.FinancialType.REFUND,
        )

        return {
            "financial_entry": financial_entry,
            "time_entry": time_entry,
        }

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_financial_entry(self, payment):
        return FinancialEntrySerializer(payment["financial_entry"]).data


class TimeEntryBulkPaymentSerializer(serializers.Serializer):
    """Paie un montant global sur plusieurs entrees de temps a la fois (bouton "Payer"
    de la page Temps), reparti de la plus ancienne a la plus recente.

    Le scope paye est celui du queryset filtre passe en contexte — les memes filtres
    que la synthese affichee. C'est ce qui rend l'action utilisable par un payeur sans
    `time_entry.view_others_detail` : il ne peut pas lister les entrees des autres, donc
    la repartition ne peut pas etre calculee cote client (voir
    `services.time_entries.pay_time_entries_oldest_first`).

    Le filtre `user` est obligatoire : on paie une personne, pas un total agrege sur
    plusieurs membres — sans ca, un meme montant se repartirait en travers de plusieurs
    beneficiaires selon le seul ordre chronologique.
    """

    amount = serializers.DecimalField(max_digits=10, decimal_places=2, write_only=True)
    paid_amount = serializers.CharField(read_only=True)
    paid_entry_count = serializers.IntegerField(read_only=True)
    partial_entry_count = serializers.IntegerField(read_only=True)

    def validate(self, attrs):
        from .services.time_entries import compute_time_entries_remaining_amount

        # `user=none` (entrees orphelines) filtre bien un scope, mais n'a pas de
        # beneficiaire a payer : seul un identifiant de membre est accepte ici.
        scope_user = self.context.get("scope_user")
        if not scope_user or not str(scope_user).isdigit():
            raise serializers.ValidationError({
                "user": "errors.time_entry_payment.user_required"
            })

        remaining_amount = compute_time_entries_remaining_amount(self.context["queryset"])

        if remaining_amount <= Decimal("0.00"):
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.nothing_to_pay"
            })

        if attrs["amount"] <= Decimal("0.00"):
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.amount_must_be_positive"
            })

        if attrs["amount"] > remaining_amount:
            raise serializers.ValidationError({
                "amount": "errors.time_entry_payment.amount_exceeds_remaining"
            })

        return attrs

    def create(self, validated_data):
        from .services.time_entries import pay_time_entries_oldest_first

        return pay_time_entries_oldest_first(
            self.context["queryset"],
            validated_data["amount"],
            self.context["request"].user,
        )


class FinancialEntrySerializer(serializers.ModelSerializer):
    folder_name = serializers.SerializerMethodField()
    task_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    time_entry_user_name = serializers.SerializerMethodField()
    documents_info = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    documents = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Document.objects.all(), required=False, write_only=True,
    )

    class Meta:
        model = FinancialEntry
        fields = [
            "id",
            "project",
            "folder",
            "folder_name",
            "documents",
            "documents_info",
            "time_entry",
            "time_entry_user_name",
            "task",
            "task_name",
            "created_by",
            "created_by_name",
            "date",
            "amount",
            "type",
            "source",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "created_by",
            "folder_name",
            "task_name",
            "created_by_name",
            "time_entry_user_name",
            "documents_info",
        ]

    def get_folder_name(self, obj):
        return obj.folder.name if obj.folder_id else None

    def get_task_name(self, obj):
        return obj.task.title if obj.task_id else None

    def get_created_by_name(self, obj):
        return get_user_display_name(obj.created_by)

    def get_time_entry_user_name(self, obj):
        if obj.time_entry_id and obj.time_entry:
            return get_user_display_name(obj.time_entry.user)
        return None

    def get_source(self, obj):
        return financial_entry_source(obj.time_entry_id is not None)

    def get_documents_info(self, obj):
        return [
            {"id": doc.id, "name": doc.file_name, "mime_type": doc.mime_type, "file_size": doc.file_size}
            for doc in obj.documents.all()
        ]

    def validate_amount(self, amount):
        if amount <= Decimal("0.00"):
            raise serializers.ValidationError("errors.financial_entry.amount_must_be_positive")
        return amount

    def create(self, validated_data):
        documents = validated_data.pop("documents", [])
        financial_entry = FinancialEntry(**validated_data)
        financial_entry.full_clean()

        financial_entry.save()
        if documents:
            financial_entry.documents.set(documents)
        return financial_entry

    def update(self, instance, validated_data):
        documents = validated_data.pop("documents", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.full_clean()

        instance.save()
        if documents is not None:
            instance.documents.set(documents)
        return instance


class ExpenseRequestSerializer(serializers.ModelSerializer):
    folder_name = serializers.SerializerMethodField()
    task_name = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    documents_info = serializers.SerializerMethodField()
    documents = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Document.objects.all(), required=False, write_only=True,
    )

    class Meta:
        model = ExpenseRequest
        fields = [
            "id",
            "project",
            "title",
            "amount",
            "category",
            "description",
            "folder",
            "folder_name",
            "documents",
            "documents_info",
            "task",
            "task_name",
            "status",
            "requested_by",
            "requested_by_name",
            "approved_at",
            "approved_by",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by",
        ]
        read_only_fields = BASE_READ_ONLY_FIELDS + [
            "project",
            "requested_by",
            "status",
            "approved_at",
            "approved_by",
            "folder_name",
            "task_name",
            "requested_by_name",
            "documents_info",
        ]

    def get_folder_name(self, obj):
        return obj.folder.name if obj.folder_id else None

    def get_task_name(self, obj):
        return obj.task.title if obj.task_id else None

    def get_requested_by_name(self, obj):
        return get_user_display_name(obj.requested_by)

    def get_documents_info(self, obj):
        return [
            {"id": doc.id, "name": doc.file_name, "mime_type": doc.mime_type, "file_size": doc.file_size}
            for doc in obj.documents.all()
        ]

    def validate_amount(self, amount):
        if amount <= Decimal("0.00"):
            raise serializers.ValidationError("errors.expense_request.amount_must_be_positive")
        return amount

    def create(self, validated_data):
        documents = validated_data.pop("documents", [])
        expense_request = ExpenseRequest(**validated_data)
        expense_request.full_clean()

        expense_request.save()
        if documents:
            expense_request.documents.set(documents)
        return expense_request

    def update(self, instance, validated_data):
        documents = validated_data.pop("documents", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.full_clean()

        instance.save()
        if documents is not None:
            instance.documents.set(documents)
        return instance


class FinancialEntryChartQuerySerializer(serializers.Serializer):
    group_by = serializers.ChoiceField(
        choices=["day", "month"],
        required=False,
        default="month",
    )
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({
                "end_date": "errors.financial_chart.end_date_before_start_date"
            })

        return attrs


class ProjectCalendarQuerySerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    include_tasks = serializers.BooleanField(required=False, default=True)
    include_time = serializers.BooleanField(required=False, default=True)

    def validate(self, attrs):
        if attrs["start_date"] > attrs["end_date"]:
            raise serializers.ValidationError({
                "end_date": "errors.calendar.end_date_before_start_date"
            })

        return attrs


class ProjectCalendarSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectCalendarSubscription
        fields = ["id", "token", "include_tasks", "include_time", "created_at", "updated_at"]
        read_only_fields = fields


class ProjectCalendarSubscriptionWriteSerializer(serializers.Serializer):
    """No cross-field `validate()` here on purpose: `include_tasks`/`include_time`
    can't both be false, but that's a `ProjectCalendarSubscription` invariant, not a
    request-shape one — enforced once in `ProjectCalendarSubscription.clean()` (called
    via `full_clean()` in `create_or_update_calendar_subscription`) rather than
    duplicated here."""

    include_tasks = serializers.BooleanField(required=False, default=True)
    include_time = serializers.BooleanField(required=False, default=True)


class FinancialEntryChartTotalsSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    expenses = serializers.CharField()
    refunds = serializers.CharField()
    balance = serializers.CharField()


class FinancialEntryChartSeriesPointSerializer(FinancialEntryChartTotalsSerializer):
    period = serializers.CharField()


class FinancialEntryChartSourceSerializer(FinancialEntryChartTotalsSerializer):
    source = serializers.ChoiceField(choices=FINANCIAL_ENTRY_SOURCES)


class FinancialEntryChartSerializer(serializers.Serializer):
    group_by = serializers.ChoiceField(choices=["day", "month"])
    start_date = serializers.DateField(allow_null=True)
    end_date = serializers.DateField(allow_null=True)
    totals = FinancialEntryChartTotalsSerializer()
    series = FinancialEntryChartSeriesPointSerializer(many=True)
    sources = FinancialEntryChartSourceSerializer(many=True)
