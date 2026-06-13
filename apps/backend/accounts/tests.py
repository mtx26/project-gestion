from unittest.mock import patch
from decimal import Decimal
import re
from urllib.parse import parse_qs, urlparse

from django.contrib.auth.models import User
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from allauth.account.models import EmailAddress, EmailConfirmationHMAC

from .models import Profile


class AccountsApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def api_post(self, url, payload, format="json"):
        return self.client.post(url, payload, format=format)

    def api_put(self, url, payload, format="json"):
        return self.client.put(url, payload, format=format)

    def api_patch(self, url, payload, format="json"):
        return self.client.patch(url, payload, format=format)


class RegisterViewTests(AccountsApiTestCase):
    def test_register_ignores_direct_picture_url(self):
        response = self.api_post(
            "/api/accounts/register/",
            {
                "username": "new-user",
                "email": "new@example.com",
                "password": "StrongPassword123!",
                "first_name": "New",
                "last_name": "User",
                "picture_url": "https://example.com/avatar.png",
            },
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="new-user")
        self.assertEqual(user.profile.picture_url, "")

    def test_register_creates_unverified_email_and_sends_confirmation(self):
        response = self.api_post(
            "/api/accounts/register/",
            {
                "username": "verify-user",
                "email": "verify@example.com",
                "password": "StrongPassword123!",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data["detail"],
            "messages.registration.created_verify_email",
        )
        self.assertEqual(response.data["email"], "verify@example.com")
        self.assertFalse(response.data["email_verified"])
        user = User.objects.get(username="verify-user")
        email_address = EmailAddress.objects.get(user=user, email="verify@example.com")
        self.assertFalse(email_address.verified)
        self.assertTrue(email_address.primary)
        self.assertEqual(len(mail.outbox), 1)

    def test_register_can_generate_username_from_email(self):
        response = self.api_post(
            "/api/accounts/register/",
            {
                "email": "Generated.User@example.com",
                "password": "StrongPassword123!",
            },
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="Generated.User@example.com")
        self.assertEqual(user.username, "Generated.User")
        self.assertEqual(response.data["email"], "Generated.User@example.com")

    def test_register_generated_username_avoids_collisions(self):
        User.objects.create_user(
            username="taken",
            email="taken-old@example.com",
            password="StrongPassword123!",
        )

        response = self.api_post(
            "/api/accounts/register/",
            {
                "email": "taken@example.com",
                "password": "StrongPassword123!",
            },
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="taken@example.com")
        self.assertEqual(user.username, "taken-2")

    def test_register_rejects_duplicate_explicit_username(self):
        User.objects.create_user(
            username="taken",
            email="taken-old@example.com",
            password="StrongPassword123!",
        )

        response = self.api_post(
            "/api/accounts/register/",
            {
                "username": "taken",
                "email": "new-taken@example.com",
                "password": "StrongPassword123!",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["username"],
            ["errors.user.username_already_exists"],
        )


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
    PASSWORD_RESET_CONFIRM_URL="https://app.example.com/auth/password-reset/confirm",
    EMAIL_VERIFICATION_URL="https://app.example.com/auth/verify-email",
)
class AuthFlowTests(AccountsApiTestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username="auth-user",
            email="auth@example.com",
            password="OldPassword123!",
        )
        Profile.objects.create(user=self.user, picture_url="")

    def test_password_reset_confirm_changes_password(self):
        refresh = RefreshToken.for_user(self.user)
        response = self.api_post(
            "/api/accounts/password/reset/",
            {"email": "auth@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        reset_link = re.search(r"https?://\S+", mail.outbox[0].body).group(0)
        query = parse_qs(urlparse(reset_link).query)

        response = self.api_post(
            "/api/accounts/password/reset/confirm/",
            {
                "uid": query["uid"][0],
                "token": query["token"][0],
                "new_password": "NewPassword123!",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPassword123!"))
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()
        )

    def test_password_reset_does_not_enumerate_unknown_email(self):
        response = self.api_post(
            "/api/accounts/password/reset/",
            {"email": "missing@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_login_requires_verified_email_when_mandatory(self):
        response = self.api_post(
            "/api/accounts/login/",
            {
                "username": "auth-user",
                "password": "OldPassword123!",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["email"],
            ["errors.email_verification.required"],
        )

    def test_login_succeeds_when_email_is_verified(self):
        EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            primary=True,
            verified=True,
        )

        response = self.api_post(
            "/api/accounts/login/",
            {
                "username": "auth-user",
                "password": "OldPassword123!",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertTrue(response.data["user"]["email_verified"])

    def test_login_accepts_email_identifier(self):
        EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            primary=True,
            verified=True,
        )

        response = self.api_post(
            "/api/accounts/login/",
            {
                "identifier": "auth@example.com",
                "password": "OldPassword123!",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["username"], "auth-user")

    def test_password_change_requires_current_password(self):
        self.authenticate(self.user)

        response = self.api_post(
            "/api/accounts/password/change/",
            {
                "old_password": "wrong",
                "new_password": "NewPassword123!",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["old_password"],
            ["errors.password.invalid_current_password"],
        )

    def test_password_change_updates_password(self):
        self.authenticate(self.user)
        refresh = RefreshToken.for_user(self.user)

        response = self.api_post(
            "/api/accounts/password/change/",
            {
                "old_password": "OldPassword123!",
                "new_password": "NewPassword123!",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPassword123!"))
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()
        )

    def test_email_verify_confirms_email(self):
        email_address = EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            primary=True,
            verified=False,
        )
        key = EmailConfirmationHMAC(email_address).key

        response = self.api_post("/api/accounts/email/verify/", {"key": key})

        self.assertEqual(response.status_code, 200)
        email_address.refresh_from_db()
        self.assertTrue(email_address.verified)

    def test_resend_verification_email(self):
        EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            primary=True,
            verified=False,
        )

        response = self.api_post(
            "/api/accounts/email/resend/",
            {"email": "auth@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["detail"],
            "messages.email.verification_sent_if_account_exists",
        )
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(
            "https://app.example.com/auth/verify-email?key=",
            mail.outbox[0].body,
        )

    def test_resend_verification_email_does_not_enumerate_unknown_email(self):
        response = self.api_post(
            "/api/accounts/email/resend/",
            {"email": "missing@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["detail"],
            "messages.email.verification_sent_if_account_exists",
        )
        self.assertEqual(len(mail.outbox), 0)

    def test_resend_verification_email_does_not_send_when_already_verified(self):
        EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            primary=True,
            verified=True,
        )

        response = self.api_post(
            "/api/accounts/email/resend/",
            {"email": "auth@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_logout_blacklists_refresh_token(self):
        self.authenticate(self.user)
        refresh = RefreshToken.for_user(self.user)

        response = self.api_post(
            "/api/accounts/logout/",
            {"refresh": str(refresh)},
        )

        self.assertEqual(response.status_code, 204)
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()
        )

    def test_logout_blacklists_refresh_token_without_access_token(self):
        refresh = RefreshToken.for_user(self.user)

        response = self.api_post(
            "/api/accounts/logout/",
            {"refresh": str(refresh)},
        )

        self.assertEqual(response.status_code, 204)
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()
        )


class AuthThrottleTests(AccountsApiTestCase):
    def test_login_is_rate_limited(self):
        User.objects.create_user(
            username="rate-user",
            email="rate@example.com",
            password="Password123!",
        )

        responses = [
            self.api_post(
                "/api/accounts/login/",
                {"username": "rate-user", "password": "wrong"},
            )
            for _ in range(6)
        ]

        self.assertEqual(responses[0].status_code, 401)
        self.assertEqual(responses[-1].status_code, 429)


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
