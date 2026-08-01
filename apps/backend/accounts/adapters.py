from urllib.parse import urlencode

from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings

from api.services.mail import send_email


class AccountAdapter(DefaultAccountAdapter):
    def get_email_confirmation_url(self, request, emailconfirmation):
        query = urlencode({"key": emailconfirmation.key})
        return f"{settings.EMAIL_VERIFICATION_URL.rstrip('/')}?{query}"

    def send_confirmation_mail(self, request, emailconfirmation, signup):
        user = emailconfirmation.email_address.user
        verify_url = self.get_email_confirmation_url(request, emailconfirmation)
        username = user.get_full_name() or user.get_username()

        send_email(
            to_email=emailconfirmation.email_address.email,
            subject="Verification de votre adresse email",
            type="email_verification",
            resend_template_id=settings.RESEND_EMAIL_VERIFICATION_TEMPLATE_ID or None,
            resend_template_variables={
                "USER_NAME": username,
                "VERIFY_URL": verify_url,
            },
            text_body=(
                f"Bonjour {username},\n\n"
                "Confirmez votre adresse email pour finaliser votre compte.\n"
                f"Verifier mon email : {verify_url}"
            ),
            metadata={"user_id": str(user.id), "signup": signup},
            reply_to=settings.DEFAULT_REPLY_TO_EMAIL,
        )

    def send_password_reset_mail(self, user, email, context):
        """Remplace le template Django d'allauth par l'envoi Resend du projet.

        `context["password_reset_url"]` est deja construit par allauth a partir de
        `HEADLESS_FRONTEND_URLS["account_reset_password_from_key"]`.
        """
        reset_url = context["password_reset_url"]
        username = user.get_full_name() or user.get_username()

        send_email(
            to_email=email,
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
