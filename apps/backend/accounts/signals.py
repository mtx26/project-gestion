from allauth.account.signals import user_signed_up
from django.dispatch import receiver

from .models import Profile


@receiver(user_signed_up)
def create_profile_on_signup(sender, request, user, **kwargs):
    """Cree le `Profile` quel que soit le mode d'inscription (email ou Google)."""
    Profile.objects.get_or_create(user=user, defaults={"picture_url": ""})
