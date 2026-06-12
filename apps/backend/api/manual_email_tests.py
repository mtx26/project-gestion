from django.conf import settings
from django.test import TestCase, override_settings

from .services.mail import send_email


def _read_env_value(name):
    for path in (settings.BASE_DIR.parent.parent / ".env.local", settings.BASE_DIR.parent.parent / ".env"):
        if not path.exists():
            continue

        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            if key.strip() == name:
                return value.strip().strip('"').strip("'")

    return getattr(settings, name, "")


class ManualEmailSendTests(TestCase):
    def test_send_tracking_email_to_matis(self):
        resend_api_key = _read_env_value("RESEND_API_KEY")
        default_from_email = _read_env_value("DEFAULT_FROM_EMAIL")

        if not resend_api_key:
            self.fail("RESEND_API_KEY is required to send the manual email test.")

        if not default_from_email:
            self.fail("DEFAULT_FROM_EMAIL is required to send the manual email test.")

        with override_settings(
            RESEND_API_KEY=resend_api_key,
            ANYMAIL={"RESEND_API_KEY": resend_api_key},
            EMAIL_BACKEND="anymail.backends.resend.EmailBackend",
            DEFAULT_FROM_EMAIL=default_from_email,
        ):
            delivery = send_email(
                to_email="matisgillet26@gmail.com",
                subject="Test tracking click",
                type="test_email",
                text_body="Test avec lien: https://meditime-app.com/api/docs/",
                metadata={"type": "manual_tracking_test"},
            )

        self.assertEqual(delivery.status, "sent")
        self.assertIsNotNone(delivery.sent_at)
        self.assertTrue(delivery.provider_message_id)

    def test_send_invitation_template_to_matis(self):
        resend_api_key = _read_env_value("RESEND_API_KEY")
        default_from_email = _read_env_value("DEFAULT_FROM_EMAIL")
        default_reply_to_email = _read_env_value("DEFAULT_REPLY_TO_EMAIL")
        invitation_template_id = _read_env_value("RESEND_INVITATION_TEMPLATE_ID") or "project-invitation"

        if not resend_api_key:
            self.fail("RESEND_API_KEY is required to send the manual invitation template test.")

        if not default_from_email:
            self.fail("DEFAULT_FROM_EMAIL is required to send the manual invitation template test.")

        with override_settings(
            RESEND_API_KEY=resend_api_key,
            ANYMAIL={"RESEND_API_KEY": resend_api_key},
            EMAIL_BACKEND="anymail.backends.resend.EmailBackend",
            DEFAULT_FROM_EMAIL=default_from_email,
            DEFAULT_REPLY_TO_EMAIL=default_reply_to_email,
            RESEND_INVITATION_TEMPLATE_ID=invitation_template_id,
        ):
            delivery = send_email(
                to_email="matisgillet26@gmail.com",
                subject="Invitation au projet Test",
                type="project_invitation",
                resend_template_id=invitation_template_id,
                resend_template_variables={
                    "PROJECT_NAME": "Projet test",
                    "INVITER_NAME": "Matis",
                    "INVITATION_URL": "https://meditime-app.com/invitations/accept?token=test",
                    "EXPIRES_AT": "2026-06-19 15:00",
                },
                metadata={"type": "manual_invitation_template_test"},
                reply_to=default_reply_to_email,
            )

        self.assertEqual(delivery.status, "sent")
        self.assertIsNotNone(delivery.sent_at)
        self.assertTrue(delivery.provider_message_id)
