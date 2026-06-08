from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class ActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class DeletedManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=False)


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(blank=True, null=True)
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
