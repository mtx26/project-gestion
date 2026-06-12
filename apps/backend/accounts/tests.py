from unittest.mock import patch
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from rest_framework.test import APIClient

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
