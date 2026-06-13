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
