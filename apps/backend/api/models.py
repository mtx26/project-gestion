from decimal import Decimal

from django.contrib.auth.models import User
from django.db import models
from django.db.models.functions import Coalesce, Round
from django.core.exceptions import ValidationError
from core.models import ActiveManagerMixin, BaseModel, DeletedManagerMixin


## Projects
class ProjectQuerySet(models.QuerySet):
    def accessible_to(self, user):
        """Projects `user` owns, or is an active (non soft-deleted) member of."""
        if not user or not user.is_authenticated:
            return self.none()
        return self.filter(
            models.Q(owner=user)
            | models.Q(projectmember__user=user, projectmember__deleted_at__isnull=True),
        ).select_related("owner").distinct().order_by("id")


class ActiveProjectManager(ActiveManagerMixin, models.Manager.from_queryset(ProjectQuerySet)):
    pass


class DeletedProjectManager(DeletedManagerMixin, models.Manager.from_queryset(ProjectQuerySet)):
    pass


class Project(BaseModel):
    objects = ActiveProjectManager()
    deleted_objects = DeletedProjectManager()
    all_objects = models.Manager.from_queryset(ProjectQuerySet)()

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
class RoleQuerySet(models.QuerySet):
    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def accessible_to(self, user):
        return self.filter(project__in=Project.objects.accessible_to(user))

    def with_relations(self):
        return self.select_related("project")


class ActiveRoleManager(ActiveManagerMixin, models.Manager.from_queryset(RoleQuerySet)):
    pass


class DeletedRoleManager(DeletedManagerMixin, models.Manager.from_queryset(RoleQuerySet)):
    pass


class Role(BaseModel):
    objects = ActiveRoleManager()
    deleted_objects = DeletedRoleManager()
    all_objects = models.Manager.from_queryset(RoleQuerySet)()

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

class PermissionQuerySet(models.QuerySet):
    def for_user_on_project(self, user, project):
        """Every permission `user` holds on `project`: all of them if `user` owns
        `project`, otherwise only those granted through an active role membership."""
        if not user or not user.is_authenticated or project is None:
            return self.none()
        if project.owner_id == user.id:
            return self
        return self.filter(
            rolepermission__role__projectmember__project=project,
            rolepermission__role__projectmember__user=user,
            rolepermission__deleted_at__isnull=True,
            rolepermission__role__deleted_at__isnull=True,
            rolepermission__role__projectmember__deleted_at__isnull=True,
        ).distinct()


class Permission(models.Model):
    objects = models.Manager.from_queryset(PermissionQuerySet)()

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

class ProjectMemberQuerySet(models.QuerySet):
    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def accessible_to(self, user):
        return self.filter(project__in=Project.objects.accessible_to(user))

    def with_relations(self):
        return self.select_related("user__profile", "role")


class ActiveProjectMemberManager(ActiveManagerMixin, models.Manager.from_queryset(ProjectMemberQuerySet)):
    pass


class DeletedProjectMemberManager(DeletedManagerMixin, models.Manager.from_queryset(ProjectMemberQuerySet)):
    pass


class ProjectMember(BaseModel):
    objects = ActiveProjectMemberManager()
    deleted_objects = DeletedProjectMemberManager()
    all_objects = models.Manager.from_queryset(ProjectMemberQuerySet)()

    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)

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
        

class ProjectOwnerRate(models.Model):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name="owner_rate")
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)


class FolderQuerySet(models.QuerySet):
    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def accessible_to(self, user):
        return self.filter(project__in=Project.objects.accessible_to(user))

    def with_relations(self):
        return self.select_related("created_by")


class ActiveFolderManager(ActiveManagerMixin, models.Manager.from_queryset(FolderQuerySet)):
    pass


class DeletedFolderManager(DeletedManagerMixin, models.Manager.from_queryset(FolderQuerySet)):
    pass


class Folder(BaseModel):
    objects = ActiveFolderManager()
    deleted_objects = DeletedFolderManager()
    all_objects = models.Manager.from_queryset(FolderQuerySet)()

    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    parent_folder = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="folders_created")
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

class DocumentQuerySet(models.QuerySet):
    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def accessible_to(self, user):
        return self.filter(project__in=Project.objects.accessible_to(user))


class ActiveDocumentManager(ActiveManagerMixin, models.Manager.from_queryset(DocumentQuerySet)):
    pass


class DeletedDocumentManager(DeletedManagerMixin, models.Manager.from_queryset(DocumentQuerySet)):
    pass


class Document(BaseModel):
    objects = ActiveDocumentManager()
    deleted_objects = DeletedDocumentManager()
    all_objects = models.Manager.from_queryset(DocumentQuerySet)()

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

class TaskQuerySet(models.QuerySet):
    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def accessible_to(self, user):
        return self.filter(project__in=Project.objects.accessible_to(user))

    def with_relations(self):
        return self.select_related(
            "project", "folder", "created_by",
        ).prefetch_related("assigned_to", "documents")

    def with_ordering_annotations(self):
        """Adds `status_order`/`priority_order`, used by `ordering_fields` on both the
        active and trash task lists to sort by workflow status/priority rather than
        alphabetically."""
        return self.annotate(
            status_order=models.Case(
                models.When(status="todo", then=models.Value(0)),
                models.When(status="in_progress", then=models.Value(1)),
                models.When(status="done", then=models.Value(2)),
                default=models.Value(0),
                output_field=models.IntegerField(),
            ),
            priority_order=models.Case(
                models.When(priority="low", then=models.Value(0)),
                models.When(priority="normal", then=models.Value(1)),
                models.When(priority="high", then=models.Value(2)),
                default=models.Value(1),
                output_field=models.IntegerField(),
            ),
        )


class ActiveTaskManager(ActiveManagerMixin, models.Manager.from_queryset(TaskQuerySet)):
    pass


class DeletedTaskManager(DeletedManagerMixin, models.Manager.from_queryset(TaskQuerySet)):
    pass


class Task(BaseModel):
    class Status(models.TextChoices):
        TODO = "todo", "todo"
        IN_PROGRESS = "in_progress", "in_progress"
        DONE = "done", "done"

    class Priority(models.TextChoices):
        LOW = "low", "low"
        NORMAL = "normal", "normal"
        HIGH = "high", "high"

    objects = ActiveTaskManager()
    deleted_objects = DeletedTaskManager()
    all_objects = models.Manager.from_queryset(TaskQuerySet)()

    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    folder = models.ForeignKey(Folder, on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks_created")
    assigned_to = models.ManyToManyField(
        User,
        blank=True,
        related_name="tasks_assigned"
    )
    documents = models.ManyToManyField(
        Document,
        blank=True,
        related_name="tasks",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.TODO, db_index=True)
    priority = models.CharField(max_length=50, choices=Priority.choices, default=Priority.NORMAL, db_index=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def clean(self):
        super().clean()

        if self.folder and self.folder.project_id != self.project_id:
            raise ValidationError("errors.task.folder_project_mismatch")

        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError({"start_date": "errors.task.start_date_after_end_date"})

class InvitationQuerySet(models.QuerySet):
    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def accessible_to(self, user):
        return self.filter(project__in=Project.objects.accessible_to(user))

    def with_relations(self):
        return self.select_related("project", "role", "invited_by")

    def pending(self):
        return self.filter(accepted_at__isnull=True)


class ActiveInvitationManager(ActiveManagerMixin, models.Manager.from_queryset(InvitationQuerySet)):
    pass


class DeletedInvitationManager(DeletedManagerMixin, models.Manager.from_queryset(InvitationQuerySet)):
    pass


class Invitation(BaseModel):
    objects = ActiveInvitationManager()
    deleted_objects = DeletedInvitationManager()
    all_objects = models.Manager.from_queryset(InvitationQuerySet)()

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
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications_created")
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=100)
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)

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

class TimeEntryQuerySet(models.QuerySet):
    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def accessible_to(self, user):
        return self.filter(project__in=Project.objects.accessible_to(user))

    def visible_to(self, user, project):
        """Restricts to `user`'s own entries unless they hold `time_entry.view_all`
        on `project`."""
        from .services.permissions import has_project_permission

        if has_project_permission(user, project, "time_entry.view_all"):
            return self
        return self.filter(user=user)

    def with_relations(self):
        return self.select_related(
            "project", "folder", "task", "user",
        ).prefetch_related("financial_entries", "documents")

    def with_financial_totals(self):
        """Annotates `filter_cost_amount`/`filter_paid_amount` (duration × hourly rate;
        net of linked FinancialEntry expenses/refunds), used by `TimeEntryFilter`
        (`payment_status`/`include_paid`) and by `compute_time_entry_stats`.

        Mirrors, at the SQL/aggregate level, the same formula as the per-instance
        `TimeEntry.get_cost_amount`/`get_paid_amount` methods below — the two can't be
        unified (one needs to filter/aggregate across rows in the database, the other
        answers for a single already-loaded instance), so keep them in sync by hand if
        the business rule ever changes.
        """
        cost_amount = Round(
            models.ExpressionWrapper(
                models.F("duration_minutes") * models.F("hourly_rate") / models.Value(60),
                output_field=models.DecimalField(max_digits=12, decimal_places=2),
            ),
            precision=2,
        )
        paid_amount = Coalesce(
            models.Sum(
                models.Case(
                    models.When(
                        financial_entries__type=FinancialEntry.FinancialType.EXPENSE,
                        then=models.F("financial_entries__amount"),
                    ),
                    models.When(
                        financial_entries__type=FinancialEntry.FinancialType.REFUND,
                        then=-models.F("financial_entries__amount"),
                    ),
                    default=models.Value(0),
                    output_field=models.DecimalField(max_digits=12, decimal_places=2),
                )
            ),
            models.Value(0),
            output_field=models.DecimalField(max_digits=12, decimal_places=2),
        )
        return self.annotate(filter_cost_amount=cost_amount, filter_paid_amount=paid_amount)

    def financial_totals(self):
        """Raw aggregate (duration/cost/paid/count) for `compute_time_entry_stats`,
        which turns this into a response payload (clamping `remaining` at zero,
        quantizing to cents). Requires `with_financial_totals()` to have been applied
        first."""
        return self.aggregate(
            total_duration=Coalesce(models.Sum("duration_minutes"), models.Value(0)),
            total_cost=Coalesce(
                models.Sum("filter_cost_amount"),
                models.Value(Decimal("0.00")),
                output_field=models.DecimalField(max_digits=12, decimal_places=2),
            ),
            total_paid=Coalesce(
                models.Sum("filter_paid_amount"),
                models.Value(Decimal("0.00")),
                output_field=models.DecimalField(max_digits=12, decimal_places=2),
            ),
            entry_count=models.Count("id"),
        )


class ActiveTimeEntryManager(ActiveManagerMixin, models.Manager.from_queryset(TimeEntryQuerySet)):
    pass


class DeletedTimeEntryManager(DeletedManagerMixin, models.Manager.from_queryset(TimeEntryQuerySet)):
    pass


class TimeEntry(BaseModel):
    objects = ActiveTimeEntryManager()
    deleted_objects = DeletedTimeEntryManager()
    all_objects = models.Manager.from_queryset(TimeEntryQuerySet)()

    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    folder = models.ForeignKey(Folder, on_delete=models.SET_NULL, null=True, blank=True)
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    start_date = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField()
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    description = models.TextField(blank=True, null=True)
    documents = models.ManyToManyField(
        Document,
        blank=True,
        related_name="time_entries",
    )

    def clean(self):
        super().clean()

        if self.folder and self.task:
            raise ValidationError("errors.time_entry.multiple_targets")

        if self.folder and self.folder.project_id != self.project_id:
            raise ValidationError("errors.time_entry.folder_project_mismatch")

        if self.task and self.task.project_id != self.project_id:
            raise ValidationError("errors.time_entry.task_project_mismatch")

    def get_cost_amount(self):
        """Montant total facturable de l'entrée (durée x taux horaire)."""
        return Decimal(self.duration_minutes) * self.hourly_rate / Decimal("60")

    def get_paid_amount(self, exclude_pk=None):
        """Solde net des entrées financières liées (dépenses - remboursements), jamais négatif."""
        entries = self.financial_entries.all()
        if exclude_pk:
            entries = entries.exclude(pk=exclude_pk)

        paid_amount = Decimal("0.00")
        for entry in entries:
            if entry.type == FinancialEntry.FinancialType.EXPENSE:
                paid_amount += entry.amount
            elif entry.type == FinancialEntry.FinancialType.REFUND:
                paid_amount -= entry.amount

        return max(paid_amount, Decimal("0.00"))

    def get_remaining_amount(self, exclude_pk=None):
        """Montant restant à payer avant que l'entrée soit intégralement couverte."""
        remaining = self.get_cost_amount() - self.get_paid_amount(exclude_pk=exclude_pk)
        return max(remaining, Decimal("0.00"))


class FinancialEntryQuerySet(models.QuerySet):
    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def accessible_to(self, user):
        return self.filter(project__in=Project.objects.accessible_to(user))

    def with_relations(self):
        return self.select_related(
            "project", "folder", "time_entry__user", "task", "created_by",
        ).prefetch_related("documents")


class ActiveFinancialEntryManager(ActiveManagerMixin, models.Manager.from_queryset(FinancialEntryQuerySet)):
    pass


class DeletedFinancialEntryManager(DeletedManagerMixin, models.Manager.from_queryset(FinancialEntryQuerySet)):
    pass


class FinancialEntry(BaseModel):
    class FinancialType(models.TextChoices):
        EXPENSE = "expense", "financial.types.expense"
        REFUND = "refund", "financial.types.refund"

    objects = ActiveFinancialEntryManager()
    deleted_objects = DeletedFinancialEntryManager()
    all_objects = models.Manager.from_queryset(FinancialEntryQuerySet)()

    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    folder = models.ForeignKey(Folder, on_delete=models.SET_NULL, null=True, blank=True)
    documents = models.ManyToManyField(
        Document,
        blank=True,
        related_name="financial_entries_docs",
    )
    time_entry = models.ForeignKey(
        TimeEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="financial_entries",
    )
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True, related_name="financial_entries")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="financial_entries_created")
    date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    type = models.CharField(max_length=50, choices=FinancialType.choices, db_index=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    
    def clean(self):
        super().clean()

        if self.folder and self.folder.project_id != self.project_id:
            raise ValidationError("errors.financial_entry.folder_project_mismatch")

        if self.time_entry and self.time_entry.project_id != self.project_id:
            raise ValidationError("errors.financial_entry.time_entry_project_mismatch")

        if self.task and self.task.project_id != self.project_id:
            raise ValidationError("errors.financial_entry.task_project_mismatch")

        if self.folder and self.task:
            raise ValidationError("errors.financial_entry.multiple_targets")

        if self.time_entry and self.amount is not None and self.type == self.FinancialType.EXPENSE:
            paid_amount = self.time_entry.get_paid_amount(exclude_pk=self.pk)
            cost_amount = self.time_entry.get_cost_amount()

            if paid_amount + self.amount > cost_amount:
                raise ValidationError({
                    "amount": "errors.financial_entry.amount_exceeds_time_entry_remaining"
                })

        if self.time_entry and self.amount is not None and self.type == self.FinancialType.REFUND:
            paid_amount = self.time_entry.get_paid_amount(exclude_pk=self.pk)

            if self.amount > paid_amount:
                raise ValidationError({
                    "amount": "errors.financial_entry.refund_exceeds_time_entry_paid_amount"
                })


class ExpenseRequestQuerySet(models.QuerySet):
    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def accessible_to(self, user):
        return self.filter(project__in=Project.objects.accessible_to(user))

    def with_relations(self):
        return self.select_related(
            "project", "folder", "task", "requested_by", "approved_by",
        ).prefetch_related("documents")


class ActiveExpenseRequestManager(ActiveManagerMixin, models.Manager.from_queryset(ExpenseRequestQuerySet)):
    pass


class DeletedExpenseRequestManager(DeletedManagerMixin, models.Manager.from_queryset(ExpenseRequestQuerySet)):
    pass


class ExpenseRequest(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        APPROVED = "approved", "Approuve"
        REJECTED = "rejected", "Refuse"

    objects = ActiveExpenseRequestManager()
    deleted_objects = DeletedExpenseRequestManager()
    all_objects = models.Manager.from_queryset(ExpenseRequestQuerySet)()

    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    folder = models.ForeignKey(Folder, on_delete=models.SET_NULL, null=True, blank=True)
    documents = models.ManyToManyField(
        Document,
        blank=True,
        related_name="expense_requests_docs",
    )
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True, related_name="expense_requests")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="expense_requests_made")
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="expense_requests_approved")

    def clean(self):
        super().clean()

        if self.folder and self.folder.project_id != self.project_id:
            raise ValidationError("errors.expense_request.folder_project_mismatch")

        if self.folder and self.task:
            raise ValidationError("errors.expense_request.multiple_targets")

        if self.task and self.task.project_id != self.project_id:
            raise ValidationError("errors.expense_request.task_project_mismatch")

    class Meta:
        ordering = ["-created_at"]
