from django.contrib.auth.models import User
from django.db import models
from core.models import BaseModel


class Profile(BaseModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    picture_url = models.URLField(blank=True, null=True)