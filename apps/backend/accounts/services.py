from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from api.services.mail import send_email


def build_password_reset_url(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    query = urlencode({"uid": uid, "token": token})
    return f"{settings.PASSWORD_RESET_CONFIRM_URL.rstrip('/')}?{query}"


def send_password_reset_email(user):
    reset_url = build_password_reset_url(user)
    username = user.get_full_name() or user.get_username()

    return send_email(
        to_email=user.email,
        subject="Reinitialisation de votre mot de passe",
        type="password_reset",
        resend_template_id=settings.RESEND_PASSWORD_RESET_TEMPLATE_ID or None,
        resend_template_variables={
            "USER_NAME": username,
            "RESET_URL": reset_url,
        },
        text_body=(
            f"Bonjour {username},\n\n"
            "Vous avez demande la reinitialisation de votre mot de passe.\n"
            f"Changer votre mot de passe : {reset_url}\n\n"
            "Si vous n'etes pas a l'origine de cette demande, ignorez cet email."
        ),
        metadata={"user_id": str(user.id)},
        reply_to=settings.DEFAULT_REPLY_TO_EMAIL,
    )
