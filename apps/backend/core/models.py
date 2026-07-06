from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class ActiveManagerMixin:
    """Mixin for a soft-delete "active rows only" manager. Combine with
    `models.Manager` directly (see `ActiveManager` below), or with
    `models.Manager.from_queryset(SomeQuerySet)` when a model has its own custom
    QuerySet — e.g. `class ActiveTaskManager(ActiveManagerMixin,
    models.Manager.from_queryset(TaskQuerySet)): pass` — so the soft-delete filter
    isn't reimplemented once per model.
    """

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class DeletedManagerMixin:
    """Same as `ActiveManagerMixin` but for soft-deleted rows."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=False)


class ActiveManager(ActiveManagerMixin, models.Manager):
    pass


class DeletedManager(DeletedManagerMixin, models.Manager):
    pass


class ProjectScopedQuerySetMixin:
    """Shared scoping for QuerySets on models with a `project` FK: filter by a
    given project id, or by every project the given user can access. Combine
    with the model's own QuerySet class — e.g. `class TaskQuerySet(
    ProjectScopedQuerySetMixin, models.QuerySet): ...` — instead of
    reimplementing `for_project`/`accessible_to` per model. Looks up the
    related `Project` model dynamically (via the `project` field) to avoid a
    circular import with `api.models`.
    """

    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def accessible_to(self, user):
        project_model = self.model._meta.get_field("project").related_model
        return self.filter(project__in=project_model.objects.accessible_to(user))


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(blank=True, null=True, db_index=True)
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_deleted_by"
    )

    objects = ActiveManager()
    deleted_objects = DeletedManager()
    all_objects = models.Manager()

    def soft_delete(self, user=None):
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save(update_fields=["deleted_at", "deleted_by", "updated_at"])

    def restore(self):
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=["deleted_at", "deleted_by", "updated_at"])

    class Meta:
        abstract = True
