from django.contrib.auth.models import User
from django.db import models
from django.core.exceptions import ValidationError
from core.models import BaseModel
    
## Projects
class Project(BaseModel):
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'name'],
                condition=models.Q(deleted_at__isnull=True),
                name='unique_active_project_name_per_owner'
            )
        ]

# Roles and Permissions
class Role(BaseModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'name'],
                condition=models.Q(deleted_at__isnull=True),
                name='unique_active_role_name_per_project'
            )
        ]

class Permission(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    code = models.CharField(max_length=100, unique=True)

class RolePermission(BaseModel):
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    permission = models.ForeignKey('Permission', on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['role', 'permission'],
                condition=models.Q(deleted_at__isnull=True),
                name='unique_active_role_permission'
            )
        ]

class ProjectMember(BaseModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)

    def clean(self):
        super().clean()

        if self.role.project_id != self.project_id:
            raise ValidationError("errors.project_member.role_project_mismatch")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'user'],
                condition=models.Q(deleted_at__isnull=True),
                name='unique_active_project_member'
            )
        ]
        

class Folder(BaseModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    parent_folder = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(max_length=7, null=True, blank=True)
    icon = models.CharField(max_length=100, null=True, blank=True)

    def clean(self):
        super().clean()

        if not self.parent_folder:
            return

        if self.pk and self.parent_folder_id == self.pk:
            raise ValidationError({
                "parent_folder": "errors.folder.parent_is_self"
            })

        if self.parent_folder.project_id != self.project_id:
            raise ValidationError({
                "parent_folder": "errors.folder.parent_project_mismatch"
            })

        parent = self.parent_folder
        visited_ids = {self.pk} if self.pk else set()

        while parent:
            if parent.pk in visited_ids:
                raise ValidationError({
                    "parent_folder": "errors.folder.circular_parent"
                })

            visited_ids.add(parent.pk)
            parent = parent.parent_folder

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'parent_folder', 'name'],
                condition=models.Q(
                    deleted_at__isnull=True,
                    parent_folder__isnull=False,
                ),
                name='unique_active_folder_name_per_parent'
            ),
            models.UniqueConstraint(
                fields=['project', 'name'],
                condition=models.Q(
                    deleted_at__isnull=True,
                    parent_folder__isnull=True,
                ),
                name='unique_active_root_folder_name'
            )
        ]

    @property
    def is_root(self):
        return self.parent_folder is None

class Document(BaseModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    folder = models.ForeignKey(Folder, on_delete=models.CASCADE, null=True, blank=True)

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    file_id = models.CharField(max_length=255, unique=True)
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, blank=True, null=True)

    def clean(self):
        super().clean()

        if self.folder and self.folder.project_id != self.project_id:
            raise ValidationError("errors.document.folder_project_mismatch")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "folder", "name"],
                condition=models.Q(
                    deleted_at__isnull=True,
                    folder__isnull=False,
                ),
                name="unique_active_document_name_per_folder"
            ),
            models.UniqueConstraint(
                fields=["project", "name"],
                condition=models.Q(
                    deleted_at__isnull=True,
                    folder__isnull=True,
                ),
                name="unique_active_root_document_name"
            )
        ]

class Task(BaseModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    folder = models.ForeignKey(Folder, on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tasks_created")
    assigned_to = models.ManyToManyField(
        User,
        blank=True,
        related_name="tasks_assigned"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50, default="todo")
    priority = models.CharField(max_length=50, default="normal")
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def clean(self):
        super().clean()

        if self.folder and self.folder.project_id != self.project_id:
            raise ValidationError("errors.task.folder_project_mismatch")

        if not self.pk:
            return

        from .services.members import get_project_assignable_users

        has_invalid_assignee = self.assigned_to.exclude(
            pk__in=get_project_assignable_users(self.project)
        ).exists()
        if has_invalid_assignee:
            raise ValidationError({
                "assigned_to": "errors.task.assigned_user_not_project_member"
            })

class Invitation(BaseModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    email = models.EmailField()
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="invitations_sent")
    token = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)

    def clean(self):
        super().clean()

        if self.role.project_id != self.project_id:
            raise ValidationError("errors.invitation.role_project_mismatch")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "email"],
                condition=models.Q(
                    accepted_at__isnull=True,
                    deleted_at__isnull=True,
                ),
                name="unique_active_pending_invitation",
            )
        ]

class Notification(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications_created")
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=100)
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)

class EmailDelivery(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", "email_delivery.status.pending"
        SENT = "sent", "email_delivery.status.sent"
        DELIVERED = "delivered", "email_delivery.status.delivered"
        FAILED = "failed", "email_delivery.status.failed"
        BOUNCED = "bounced", "email_delivery.status.bounced"
        DEFERRED = "deferred", "email_delivery.status.deferred"
        COMPLAINED = "complained", "email_delivery.status.complained"
        OPENED = "opened", "email_delivery.status.opened"
        CLICKED = "clicked", "email_delivery.status.clicked"

    to_email = models.EmailField()
    type = models.CharField(max_length=100)
    subject = models.CharField(max_length=255)
    provider = models.CharField(max_length=50, default="resend")
    provider_message_id = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(
        max_length=50,
        choices=Status.choices,
        default=Status.PENDING,
    )
    error_message = models.TextField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    invitation = models.ForeignKey(
        Invitation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    bounced_at = models.DateTimeField(null=True, blank=True)
    complained_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)

class TimeEntry(BaseModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    folder = models.ForeignKey(Folder, on_delete=models.SET_NULL, null=True, blank=True)
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    duration_minutes = models.PositiveIntegerField()
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    description = models.TextField(blank=True, null=True)

    def clean(self):
        super().clean()

        if not self.folder and not self.task:
            raise ValidationError("errors.time_entry.missing_target")

        if self.folder and self.task:
            raise ValidationError("errors.time_entry.multiple_targets")

        if self.folder and self.folder.project_id != self.project_id:
            raise ValidationError("errors.time_entry.folder_project_mismatch")

        if self.task and self.task.project_id != self.project_id:
            raise ValidationError("errors.time_entry.task_project_mismatch")

class FinancialEntry(BaseModel):
    class FinancialType(models.TextChoices):
        EXPENSE = "expense", "financial.types.expense"
        INVOICE = "invoice", "financial.types.invoice"
        REFUND = "refund", "financial.types.refund"
        PAYMENT = "payment", "financial.types.payment"

    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    folder = models.ForeignKey(Folder, on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="financial_entries_created")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    type = models.CharField(max_length=50, choices=FinancialType.choices)
    category = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    
    def clean(self):
        super().clean()

        if self.folder and self.folder.project_id != self.project_id:
            raise ValidationError("errors.financial_entry.folder_project_mismatch")
