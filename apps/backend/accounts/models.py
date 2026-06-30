from django.contrib.auth.models import User
from django.db import models
from core.models import BaseModel


class Profile(BaseModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    picture_url = models.URLField(blank=True, null=True)
    default_hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    default_project = models.ForeignKey(
        "api.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
