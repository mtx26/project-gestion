from unittest.mock import patch
from decimal import Decimal
import re
from urllib.parse import parse_qs, urlparse

from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from rest_framework.test import APIClient
from allauth.account.models import EmailAddress, EmailConfirmationHMAC

from .models import Profile


HEADLESS_BROWSER_URL = "/_allauth/browser/v1"
HEADLESS_APP_URL = "/_allauth/app/v1"


class AccountsApiTestCase(TestCase):
    def setUp(self):
        # Les limites de debit d'allauth vivent dans le cache : sans purge, elles
        # fuient d'un test a l'autre (le cache local persiste dans le process).
        cache.clear()
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def api_post(self, url, payload, format="json"):
        return self.client.post(url, payload, format=format)

    def api_put(self, url, payload, format="json"):
        return self.client.put(url, payload, format=format)

    def api_patch(self, url, payload, format="json"):
        return self.client.patch(url, payload, format=format)


class HeadlessSignupTests(AccountsApiTestCase):
    def test_signup_creates_profile_and_sends_confirmation(self):
        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/signup",
            {
                "email": "verify@example.com",
                "password": "StrongPassword123!",
                "first_name": "New",
                "last_name": "User",
            },
        )

        # Email verification is mandatory: allauth answers 401 with the pending
        # `verify_email` flow instead of opening a session.
        self.assertEqual(response.status_code, 401)
        user = User.objects.get(email="verify@example.com")
        self.assertEqual(user.first_name, "New")
        self.assertEqual(user.last_name, "User")
        self.assertEqual(user.profile.picture_url, "")
        email_address = EmailAddress.objects.get(user=user, email="verify@example.com")
        self.assertFalse(email_address.verified)
        self.assertTrue(email_address.primary)
        self.assertEqual(len(mail.outbox), 1)

    def test_signup_generates_username_from_email(self):
        self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/signup",
            {
                "email": "generated.user@example.com",
                "password": "StrongPassword123!",
                "first_name": "Generated",
                "last_name": "User",
            },
        )

        user = User.objects.get(email="generated.user@example.com")
        self.assertEqual(user.username, "generated")

    def test_signup_requires_first_and_last_name(self):
        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/signup",
            {"email": "partial@example.com", "password": "StrongPassword123!"},
        )

        self.assertEqual(response.status_code, 400)
        params = {error["param"] for error in response.json()["errors"]}
        self.assertEqual(params, {"first_name", "last_name"})
        self.assertFalse(User.objects.filter(email="partial@example.com").exists())


@override_settings(
    PASSWORD_RESET_CONFIRM_URL="https://app.example.com/auth/reset-password",
    EMAIL_VERIFICATION_URL="https://app.example.com/auth/verify-email",
    HEADLESS_FRONTEND_URLS={
        "account_confirm_email": "https://app.example.com/auth/verify-email?key={key}",
        "account_reset_password": "https://app.example.com/auth/forgot-password",
        "account_reset_password_from_key": (
            "https://app.example.com/auth/reset-password?key={key}"
        ),
        "account_signup": "https://app.example.com/auth/register",
        "socialaccount_login_error": "https://app.example.com/auth/login",
    },
)
class HeadlessAuthFlowTests(AccountsApiTestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username="auth-user",
            email="auth@example.com",
            password="OldPassword123!",
        )
        Profile.objects.create(user=self.user, picture_url="")

    def verify_email(self):
        return EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            primary=True,
            verified=True,
        )

    def test_login_requires_verified_email_when_mandatory(self):
        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/login",
            {"username": "auth-user", "password": "OldPassword123!"},
        )

        self.assertEqual(response.status_code, 401)
        pending = [
            flow
            for flow in response.json()["data"]["flows"]
            if flow.get("is_pending")
        ]
        self.assertEqual([flow["id"] for flow in pending], ["verify_email"])

    def test_login_opens_a_django_session(self):
        self.verify_email()

        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/login",
            {"username": "auth-user", "password": "OldPassword123!"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("sessionid", response.cookies)
        self.assertEqual(response.json()["data"]["user"]["username"], "auth-user")
        # La session est utilisable telle quelle sur les endpoints DRF du projet.
        self.assertEqual(self.client.get("/api/accounts/me/").status_code, 200)

    def test_login_accepts_email(self):
        self.verify_email()

        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/login",
            {"email": "auth@example.com", "password": "OldPassword123!"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["user"]["username"], "auth-user")

    def test_logout_closes_the_session(self):
        self.verify_email()
        self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/login",
            {"email": "auth@example.com", "password": "OldPassword123!"},
        )

        response = self.client.delete(f"{HEADLESS_BROWSER_URL}/auth/session")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.client.get("/api/accounts/me/").status_code, 401)

    def test_sessions_on_several_devices_are_independent(self):
        self.verify_email()
        phone = APIClient()
        laptop = APIClient()
        credentials = {"email": "auth@example.com", "password": "OldPassword123!"}

        phone.post(f"{HEADLESS_BROWSER_URL}/auth/login", credentials, format="json")
        laptop.post(f"{HEADLESS_BROWSER_URL}/auth/login", credentials, format="json")
        phone.delete(f"{HEADLESS_BROWSER_URL}/auth/session")

        self.assertEqual(phone.get("/api/accounts/me/").status_code, 401)
        self.assertEqual(laptop.get("/api/accounts/me/").status_code, 200)

    def test_app_client_authenticates_with_session_token(self):
        self.verify_email()

        login = self.api_post(
            f"{HEADLESS_APP_URL}/auth/login",
            {"email": "auth@example.com", "password": "OldPassword123!"},
        )

        self.assertEqual(login.status_code, 200)
        session_token = login.json()["meta"]["session_token"]
        client = APIClient()
        response = client.get(
            "/api/accounts/me/",
            headers={"x-session-token": session_token},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "auth-user")

    def test_password_reset_changes_password(self):
        self.verify_email()

        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/password/request",
            {"email": "auth@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        reset_link = re.search(r"https?://\S+", mail.outbox[0].body).group(0)
        self.assertTrue(
            reset_link.startswith("https://app.example.com/auth/reset-password?key=")
        )
        key = parse_qs(urlparse(reset_link).query)["key"][0]

        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/password/reset",
            {"key": key, "password": "NewPassword123!"},
        )

        self.assertIn(response.status_code, (200, 401))
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPassword123!"))

    def test_password_reset_does_not_enumerate_unknown_email(self):
        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/password/request",
            {"email": "missing@example.com"},
        )

        # `ACCOUNT_PREVENT_ENUMERATION` : meme reponse que pour un compte connu,
        # et allauth envoie un mail "compte inconnu" sans lien de reinitialisation.
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertNotIn("/auth/reset-password?key=", mail.outbox[0].body)

    def test_password_change_requires_current_password(self):
        self.verify_email()
        self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/login",
            {"email": "auth@example.com", "password": "OldPassword123!"},
        )

        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/account/password/change",
            {"current_password": "wrong", "new_password": "NewPassword123!"},
        )

        self.assertEqual(response.status_code, 400)
        params = {error["param"] for error in response.json()["errors"]}
        self.assertIn("current_password", params)

    def test_password_change_updates_password(self):
        self.verify_email()
        self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/login",
            {"email": "auth@example.com", "password": "OldPassword123!"},
        )

        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/account/password/change",
            {
                "current_password": "OldPassword123!",
                "new_password": "NewPassword123!",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPassword123!"))

    def test_email_verify_confirms_email(self):
        email_address = EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            primary=True,
            verified=False,
        )
        key = EmailConfirmationHMAC(email_address).key

        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/email/verify",
            {"key": key},
        )

        self.assertIn(response.status_code, (200, 401))
        email_address.refresh_from_db()
        self.assertTrue(email_address.verified)

    def test_login_resends_verification_email_when_email_is_unverified(self):
        EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            primary=True,
            verified=False,
        )

        response = self.api_post(
            f"{HEADLESS_BROWSER_URL}/auth/login",
            {"email": "auth@example.com", "password": "OldPassword123!"},
        )

        # `EmailVerificationStage` renvoie un nouveau lien a chaque tentative de
        # connexion : c'est le mecanisme officiel de renvoi en verification par lien.
        self.assertEqual(response.status_code, 401)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(
            "https://app.example.com/auth/verify-email?key=",
            mail.outbox[0].body,
        )


@override_settings(
    CSRF_TRUSTED_ORIGINS=["https://app.example.com"],
    SOCIALACCOUNT_PROVIDERS={
        "google": {
            "SCOPE": ["profile", "email"],
            "APPS": [{"client_id": "test-client-id", "secret": "test-secret", "key": ""}],
        }
    },
)
class GoogleProviderRedirectTests(AccountsApiTestCase):
    url = f"{HEADLESS_BROWSER_URL}/auth/provider/redirect"

    def test_redirects_to_google(self):
        response = self.client.post(
            self.url,
            {
                "provider": "google",
                "callback_url": "https://app.example.com/auth/callback",
                "process": "login",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertTrue(
            response["Location"].startswith("https://accounts.google.com/o/oauth2/v2/auth"),
            response["Location"],
        )
        self.assertIn("client_id=test-client-id", response["Location"])

    def test_rejects_callback_url_on_an_untrusted_host(self):
        response = self.client.post(
            self.url,
            {
                "provider": "google",
                "callback_url": "https://evil.example.com/steal",
                "process": "login",
            },
        )

        # allauth renvoie vers la page d'erreur du frontend, jamais vers le provider
        # ni vers l'hote non declare.
        self.assertNotIn("accounts.google.com", response.get("Location", ""))
        self.assertNotIn("evil.example.com", response.get("Location", ""))


class CurrentUserDetailViewTests(AccountsApiTestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username="current-user",
            email="current@example.com",
            password="password",
            first_name="Current",
            last_name="User",
        )
        Profile.objects.create(
            user=self.user,
            picture_url="https://storage.example/current.png",
            default_hourly_rate=25,
        )
        self.authenticate(self.user)
        self.url = "/api/accounts/me/"

    def test_anonymous_user_is_rejected(self):
        response = APIClient().get(self.url)

        self.assertEqual(response.status_code, 401)

    def test_user_can_patch_editable_fields(self):
        response = self.api_patch(
            self.url,
            {
                "first_name": "Updated",
                "profile": {
                    "default_hourly_rate": "42.50",
                },
            },
        )

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.first_name, "Updated")
        self.assertEqual(self.user.profile.default_hourly_rate, Decimal("42.50"))
        self.assertEqual(response.data["profile"]["default_hourly_rate"], "42.50")
        self.assertFalse(response.data["email_verified"])

    def test_me_marks_email_verified(self):
        EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            primary=True,
            verified=True,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["email_verified"])

    def test_user_can_put_editable_fields_only(self):
        response = self.api_put(
            self.url,
            {
                "id": 999,
                "username": "updated-user",
                "email": "changed@example.com",
                "first_name": "Updated",
                "last_name": "Name",
                "profile": {
                    "picture_url": "https://storage.example/changed.png",
                    "default_hourly_rate": "55.00",
                },
            },
        )

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.id, response.data["id"])
        self.assertEqual(self.user.username, "updated-user")
        self.assertEqual(self.user.email, "current@example.com")
        self.assertEqual(self.user.first_name, "Updated")
        self.assertEqual(self.user.last_name, "Name")
        self.assertEqual(
            self.user.profile.picture_url,
            "https://storage.example/current.png",
        )
        self.assertEqual(self.user.profile.default_hourly_rate, Decimal("55.00"))
        self.assertEqual(response.data["email"], "current@example.com")
        self.assertEqual(
            response.data["profile"]["picture_url"],
            "https://storage.example/current.png",
        )


@override_settings(
    PROFILE_PICTURE_MAX_UPLOAD_SIZE_BYTES=1024,
    PROFILE_PICTURE_ALLOWED_FILE_EXTENSIONS={".jpg", ".jpeg", ".png"},
    PROFILE_PICTURE_ALLOWED_MIME_TYPES={"image/jpeg", "image/png"},
)
class CurrentUserProfilePictureViewTests(AccountsApiTestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username="profile-user",
            email="profile@example.com",
            password="password",
        )
        Profile.objects.create(user=self.user, picture_url="")
        self.authenticate(self.user)
        self.url = "/api/accounts/me/picture/"

    def make_file(self, name="avatar.png", content_type="image/png", content=b"image"):
        return SimpleUploadedFile(name, content, content_type=content_type)

    @patch("accounts.views.upload_profile_picture_file")
    def test_user_can_upload_profile_picture(self, upload_profile_picture_file):
        upload_profile_picture_file.return_value = {
            "file_id": "users/1/profile-pictures/avatar.png",
            "url": "https://storage.example/bucket/users/1/profile-pictures/avatar.png",
        }

        response = self.api_post(
            self.url,
            {"file": self.make_file()},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        upload_profile_picture_file.assert_called_once()

        self.user.profile.refresh_from_db()
        self.assertEqual(
            self.user.profile.picture_url,
            "https://storage.example/bucket/users/1/profile-pictures/avatar.png",
        )
        self.assertEqual(
            response.data["profile"]["picture_url"],
            "https://storage.example/bucket/users/1/profile-pictures/avatar.png",
        )

    @patch("accounts.views.delete_profile_picture_file")
    @patch("accounts.views.upload_profile_picture_file")
    def test_upload_deletes_previous_profile_picture(self, upload_profile_picture_file, delete_profile_picture_file):
        previous_file_id = f"users/{self.user.id}/profile-pictures/old.png"
        self.user.profile.picture_url = f"https://storage.example/bucket/{previous_file_id}"
        self.user.profile.save(update_fields=["picture_url"])
        upload_profile_picture_file.return_value = {
            "file_id": f"users/{self.user.id}/profile-pictures/new.png",
            "url": f"https://storage.example/bucket/users/{self.user.id}/profile-pictures/new.png",
        }

        response = self.api_post(
            self.url,
            {"file": self.make_file()},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        delete_profile_picture_file.assert_called_once_with(previous_file_id)

    def test_profile_picture_file_is_required(self):
        response = self.api_post(self.url, {}, format="multipart")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["file"], ["errors.profile_picture.file_required"])

    def test_rejects_non_image_profile_picture(self):
        response = self.api_post(
            self.url,
            {"file": self.make_file(name="avatar.exe", content_type="application/x-msdownload")},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["file"], ["errors.profile_picture.file_type_not_allowed"])
