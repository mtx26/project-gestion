from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.mail import EmailMessage
from django.test import TestCase, override_settings
from django.utils import timezone
from anymail.backends.resend import EmailBackend as ResendEmailBackend
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from .models import (
    Document,
    EmailDelivery,
    Folder,
    Invitation,
    Notification,
    Permission,
    Project,
    ProjectMember,
    Role,
    RolePermission,
    Task,
    TimeEntry,
    FinancialEntry,
    ExpenseRequest,
)
from .services.mail import send_email
from .services.storage import validate_document_file


class ProjectApiTestCase(TestCase):
    # Test order inside route classes:
    # anonymous, owner, member with permission, member without permission,
    # non-member, cross-project, then endpoint-specific filters/validations.
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="owner",
            email="owner@example.com",
        )
        cls.member = User.objects.create_user(
            username="member",
            email="member@example.com",
        )
        cls.other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
        )

        cls.project = Project.objects.create(
            owner=cls.owner,
            name="Main project",
            description="Main project description",
        )
        cls.other_project = Project.objects.create(
            owner=cls.other_user,
            name="Other project",
        )

    def setUp(self):
        self.client = APIClient()

    # GIVEN
    def given_authenticated(self, user):
        self.client.force_authenticate(user=user)

    def given_permission(self, code, name=None, description=None):
        permission, _ = Permission.objects.get_or_create(
            code=code,
            defaults={
                "name": name or code,
                "description": description or code,
            },
        )
        return permission

    def given_member_with_permissions(self, permissions, user=None, project=None):
        user = user or self.member
        project = project or self.project

        role = Role.objects.create(
            project=project,
            name=f"Role for {user.username}",
        )

        for code in permissions:
            permission = self.given_permission(code)
            RolePermission.objects.create(
                role=role,
                permission=permission,
            )

        ProjectMember.objects.create(
            project=project,
            user=user,
            role=role,
        )

        return role

    def given_member_authenticated(self, permissions=None):
        self.given_member_with_permissions(permissions or [])
        self.given_authenticated(self.member)

    # WHEN
    def api_get(self, url):
        return self.client.get(url)

    def api_post(self, url, payload):
        return self.client.post(url, payload, format="json")

    def api_patch(self, url, payload):
        return self.client.patch(url, payload, format="json")

    def api_delete(self, url):
        return self.client.delete(url)

    # RESPONSE
    def response_data(self, response):
        if not response.content:
            return None
        return response.json()

    def response_results(self, response):
        data = self.response_data(response)
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    # ASSERT
    def assert_status(self, response, expected_status):
        self.assertEqual(
            response.status_code,
            expected_status,
            response.content.decode(),
        )

    def assert_ok(self, response):
        self.assert_status(response, status.HTTP_200_OK)

    def assert_created(self, response):
        self.assert_status(response, status.HTTP_201_CREATED)

    def assert_no_content(self, response):
        self.assert_status(response, status.HTTP_204_NO_CONTENT)

    def assert_bad_request(self, response):
        self.assert_status(response, status.HTTP_400_BAD_REQUEST)

    def assert_unauthorized(self, response):
        self.assert_status(response, status.HTTP_401_UNAUTHORIZED)
    
    def assert_not_found(self, response):
        self.assert_status(response, status.HTTP_404_NOT_FOUND)

    def assert_forbidden(self, response):
        self.assert_status(response, status.HTTP_403_FORBIDDEN)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="Project Gestion <no-reply@example.com>",
)
class EmailDeliveryServiceTests(TestCase):
    def test_send_email_creates_delivery_and_sends_message(self):
        delivery = send_email(
            to_email="recipient@example.com",
            subject="Invitation",
            type="project_invitation",
            text_body="Vous avez ete invite.",
            metadata={"invitation_id": "123"},
        )

        self.assertEqual(delivery.status, EmailDelivery.Status.SENT)
        self.assertIsNotNone(delivery.sent_at)
        self.assertEqual(delivery.to_email, "recipient@example.com")
        self.assertEqual(delivery.type, "project_invitation")
        self.assertEqual(delivery.metadata, {"invitation_id": "123"})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["recipient@example.com"])

    def test_send_email_can_use_resend_template_through_anymail(self):
        delivery = send_email(
            to_email="recipient@example.com",
            subject="Invitation",
            type="project_invitation",
            text_body="Fallback invitation text.",
            resend_template_id="project-invitation",
            resend_template_variables={
                "PROJECT_NAME": "Main project",
                "INVITER_NAME": "Owner",
                "INVITATION_URL": "https://example.com/invitations/accept?token=abc",
                "EXPIRES_AT": "2026-06-19 12:00",
            },
            metadata={"invitation_id": "123"},
            reply_to="contact@example.com",
        )

        self.assertEqual(delivery.status, EmailDelivery.Status.SENT)
        self.assertEqual(delivery.metadata, {"invitation_id": "123"})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].body, "Fallback invitation text.")
        self.assertEqual(mail.outbox[0].reply_to, ["contact@example.com"])
        self.assertEqual(
            mail.outbox[0].esp_extra["template"]["id"],
            "project-invitation",
        )
        self.assertEqual(
            mail.outbox[0].esp_extra["template"]["variables"]["PROJECT_NAME"],
            "Main project",
        )

    @override_settings(EMAIL_BACKEND="anymail.backends.resend.EmailBackend")
    def test_send_email_omits_body_when_resend_template_is_used(self):
        sent_messages = []

        def capture_send(message):
            sent_messages.append(message)
            return 1

        with patch.object(EmailMessage, "send", autospec=True, side_effect=capture_send):
            delivery = send_email(
                to_email="recipient@example.com",
                subject="Invitation",
                type="project_invitation",
                text_body="Fallback invitation text.",
                resend_template_id="project-invitation",
                resend_template_variables={"PROJECT_NAME": "Main project"},
            )

        self.assertEqual(delivery.status, EmailDelivery.Status.SENT)
        self.assertEqual(len(sent_messages), 1)
        self.assertIsNone(sent_messages[0].body)
        payload = ResendEmailBackend(api_key="test-key").build_message_payload(
            sent_messages[0],
            {},
        )
        self.assertNotIn("text", payload.data)
        self.assertEqual(payload.data["template"]["id"], "project-invitation")


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="Project Gestion <notifications@mail.meditime-app.com>",
    FRONTEND_APP_URL="https://app.example.com",
    INVITATION_EXPIRES_DAYS=7,
)
class InvitationWorkflowTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.role = Role.objects.create(
            project=self.project,
            name="Invited role",
        )
        self.url = f"/api/projects/{self.project.id}/invitations/"

    def invite(self, email, role=None):
        return self.api_post(self.url, {
            "email": email,
            "role": role or self.role.id,
        })

    def patch_invitation(self, invitation, payload):
        return self.api_patch(
            f"/api/projects/{self.project.id}/invitations/{invitation.id}/",
            payload,
        )

    def test_anonymous_cannot_invite(self):
        response = self.invite("new@example.com")

        self.assert_unauthorized(response)
        self.assertFalse(Invitation.objects.filter(email="new@example.com").exists())
        self.assertFalse(EmailDelivery.objects.exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_owner_invites_existing_user_with_notification_only(self):
        self.given_authenticated(self.owner)

        response = self.invite(self.other_user.email)

        self.assert_created(response)
        invitation = Invitation.objects.get(email=self.other_user.email)
        self.assertIsNone(invitation.accepted_at)
        notification = Notification.objects.get(
            user=self.other_user,
            project=self.project,
            type="project_invitation",
        )
        self.assertEqual(notification.data["invitation_id"], invitation.id)
        self.assertEqual(notification.data["token"], invitation.token)
        self.assertFalse(EmailDelivery.objects.exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_owner_invites_unknown_email_with_external_email(self):
        self.given_authenticated(self.owner)

        response = self.invite("new@example.com")

        self.assert_created(response)
        invitation = Invitation.objects.get(email="new@example.com")
        delivery = EmailDelivery.objects.get(invitation=invitation)
        self.assertEqual(delivery.status, EmailDelivery.Status.SENT)
        self.assertEqual(delivery.type, "project_invitation")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["new@example.com"])
        self.assertEqual(mail.outbox[0].from_email, "Project Gestion <notifications@mail.meditime-app.com>")
        self.assertEqual(mail.outbox[0].reply_to, [])
        self.assertIn("Invitation au projet Main project", mail.outbox[0].subject)
        self.assertIn(invitation.token, mail.outbox[0].body)
        self.assertIn("https://app.example.com/invitations/accept?token=", mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].tags, ["project_invitation"])
        self.assertEqual(mail.outbox[0].metadata["email_delivery_id"], str(delivery.id))
        self.assertEqual(mail.outbox[0].metadata["type"], "project_invitation")
        self.assertEqual(mail.outbox[0].metadata["invitation_id"], str(invitation.id))
        self.assertEqual(mail.outbox[0].metadata["project_id"], str(self.project.id))
        self.assertEqual(delivery.to_email, "new@example.com")
        self.assertEqual(delivery.subject, "Invitation au projet Main project")
        self.assertEqual(delivery.metadata, {
            "invitation_id": str(invitation.id),
            "project_id": str(self.project.id),
        })
        self.assertFalse(getattr(mail.outbox[0], "alternatives", []))

    def test_member_with_member_edit_can_invite_unknown_email(self):
        self.given_member_authenticated(["member.edit"])

        response = self.invite("new@example.com")

        self.assert_created(response)
        self.assertTrue(Invitation.objects.filter(email="new@example.com").exists())

    def test_member_without_member_edit_cannot_invite(self):
        self.given_member_authenticated(["member.view"])

        response = self.invite("new@example.com")

        self.assert_forbidden(response)
        self.assertFalse(Invitation.objects.filter(email="new@example.com").exists())

    def test_non_member_cannot_invite(self):
        self.given_authenticated(self.other_user)

        response = self.invite("new@example.com")

        self.assert_forbidden(response)
        self.assertFalse(Invitation.objects.filter(email="new@example.com").exists())
        self.assertFalse(EmailDelivery.objects.exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_cannot_invite_with_role_from_another_project(self):
        other_role = Role.objects.create(
            project=self.other_project,
            name="Other project invited role",
        )
        self.given_authenticated(self.owner)

        response = self.invite("new@example.com", role=other_role.id)

        self.assert_bad_request(response)
        self.assertFalse(Invitation.objects.filter(email="new@example.com").exists())
        self.assertFalse(EmailDelivery.objects.exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_cannot_invite_same_email_twice_while_pending(self):
        self.given_authenticated(self.owner)
        first_response = self.invite("new@example.com")

        second_response = self.invite("new@example.com")

        self.assert_created(first_response)
        self.assert_bad_request(second_response)
        self.assertEqual(Invitation.objects.filter(email="new@example.com").count(), 1)
        self.assertEqual(EmailDelivery.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 1)

    def test_owner_can_patch_invitation_role(self):
        next_role = Role.objects.create(project=self.project, name="Next invited role")
        self.given_authenticated(self.owner)
        self.invite("new@example.com")
        invitation = Invitation.objects.get(email="new@example.com")

        response = self.patch_invitation(invitation, {"role": next_role.id})

        self.assert_ok(response)
        invitation.refresh_from_db()
        self.assertEqual(invitation.role_id, next_role.id)

    def test_member_with_member_edit_can_patch_invitation_role(self):
        next_role = Role.objects.create(project=self.project, name="Next invited role")
        self.given_authenticated(self.owner)
        self.invite("new@example.com")
        invitation = Invitation.objects.get(email="new@example.com")
        self.given_member_authenticated(["member.edit"])

        response = self.patch_invitation(invitation, {"role": next_role.id})

        self.assert_ok(response)
        invitation.refresh_from_db()
        self.assertEqual(invitation.role_id, next_role.id)

    def test_member_without_member_edit_cannot_patch_invitation_role(self):
        next_role = Role.objects.create(project=self.project, name="Next invited role")
        self.given_authenticated(self.owner)
        self.invite("new@example.com")
        invitation = Invitation.objects.get(email="new@example.com")
        self.given_member_authenticated(["member.view"])

        response = self.patch_invitation(invitation, {"role": next_role.id})

        self.assert_forbidden(response)
        invitation.refresh_from_db()
        self.assertEqual(invitation.role_id, self.role.id)

    def test_patch_invitation_rejects_role_from_another_project(self):
        other_role = Role.objects.create(project=self.other_project, name="Other invited role")
        self.given_authenticated(self.owner)
        self.invite("new@example.com")
        invitation = Invitation.objects.get(email="new@example.com")

        response = self.patch_invitation(invitation, {"role": other_role.id})

        self.assert_bad_request(response)
        invitation.refresh_from_db()
        self.assertEqual(invitation.role_id, self.role.id)

    @override_settings(DEFAULT_REPLY_TO_EMAIL="contact@example.com")
    def test_owner_invites_unknown_email_with_reply_to(self):
        self.given_authenticated(self.owner)

        response = self.invite("new@example.com")

        self.assert_created(response)
        invitation = Invitation.objects.get(email="new@example.com")
        delivery = EmailDelivery.objects.get(invitation=invitation)
        self.assertEqual(delivery.status, EmailDelivery.Status.SENT)
        self.assertEqual(delivery.metadata["invitation_id"], str(invitation.id))
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].reply_to, ["contact@example.com"])

    def test_invited_user_can_accept_invitation(self):
        self.given_authenticated(self.owner)
        self.invite("new@example.com")
        invitation = Invitation.objects.get(email="new@example.com")
        invited_user = User.objects.create_user(
            username="new-user",
            email="new@example.com",
        )
        self.given_authenticated(invited_user)

        response = self.api_post("/api/invitations/accept/", {
            "token": invitation.token,
        })

        self.assert_ok(response)
        invitation.refresh_from_db()
        self.assertIsNotNone(invitation.accepted_at)
        self.assertTrue(
            ProjectMember.objects.filter(
                project=self.project,
                user=invited_user,
                role=self.role,
            ).exists()
        )

    def test_accepting_internal_invitation_soft_deletes_invitation_notification(self):
        self.given_authenticated(self.owner)
        self.invite(self.other_user.email)
        invitation = Invitation.objects.get(email=self.other_user.email)
        notification = Notification.objects.get(
            user=self.other_user,
            type="project_invitation",
            data__invitation_id=invitation.id,
        )
        self.given_authenticated(self.other_user)

        response = self.api_post("/api/invitations/accept/", {
            "token": invitation.token,
        })

        self.assert_ok(response)
        notification.refresh_from_db()
        self.assertIsNotNone(notification.deleted_at)
        self.assertEqual(notification.deleted_by_id, self.other_user.id)
        self.assertTrue(notification.is_read)

    def test_invitation_email_must_match_authenticated_user(self):
        self.given_authenticated(self.owner)
        self.invite("new@example.com")
        invitation = Invitation.objects.get(email="new@example.com")
        self.given_authenticated(self.member)

        response = self.api_post("/api/invitations/accept/", {
            "token": invitation.token,
        })

        self.assert_bad_request(response)
        self.assertFalse(
            ProjectMember.objects.filter(
                project=self.project,
                user=self.member,
            ).exists()
        )


class UserRouteTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.url = "/api/users/"

    # WHEN
    def when_list_users(self, query=""):
        return self.api_get(f"{self.url}{query}")

    # ASSERT
    def assert_visible_usernames(self, response, expected_usernames):
        users = self.response_results(response)
        usernames = {user["username"] for user in users}
        self.assertEqual(usernames, set(expected_usernames))

    # TESTS GET
    def test_anonymous_cannot_list_users(self):
        response = self.when_list_users()

        self.assert_unauthorized(response)

    def test_authenticated_user_can_list_users(self):
        self.given_authenticated(self.owner)

        response = self.when_list_users()

        self.assert_ok(response)
        self.assert_visible_usernames(response, ["owner", "member", "other"])

    def test_search_filters_users(self):
        self.given_authenticated(self.owner)

        response = self.when_list_users("?search=owner")

        self.assert_ok(response)
        self.assert_visible_usernames(response, ["owner"])


@override_settings(
    DOCUMENT_MAX_UPLOAD_SIZE_BYTES=10,
    DOCUMENT_ALLOWED_FILE_EXTENSIONS={".pdf", ".dwg"},
    DOCUMENT_ALLOWED_MIME_TYPES={"application/pdf", "image/vnd.dwg"},
    DOCUMENT_FALLBACK_MIME_TYPES={"application/octet-stream"},
)

class DocumentFileValidationTests(TestCase):
    def test_accepts_allowed_pdf(self):
        uploaded_file = SimpleUploadedFile(
            "plan.pdf",
            b"pdf",
            content_type="application/pdf",
        )

        validate_document_file(uploaded_file)

    def test_rejects_file_over_max_size(self):
        uploaded_file = SimpleUploadedFile(
            "plan.pdf",
            b"too large content",
            content_type="application/pdf",
        )

        with self.assertRaises(ValidationError):
            validate_document_file(uploaded_file)

    def test_rejects_disallowed_extension(self):
        uploaded_file = SimpleUploadedFile(
            "script.exe",
            b"ok",
            content_type="application/pdf",
        )

        with self.assertRaises(ValidationError):
            validate_document_file(uploaded_file)

    def test_rejects_disallowed_mime_type(self):
        uploaded_file = SimpleUploadedFile(
            "plan.pdf",
            b"ok",
            content_type="application/x-msdownload",
        )

        with self.assertRaises(ValidationError):
            validate_document_file(uploaded_file)

    def test_accepts_fallback_mime_type_for_allowed_extension(self):
        uploaded_file = SimpleUploadedFile(
            "plan.dwg",
            b"ok",
            content_type="application/octet-stream",
        )

        validate_document_file(uploaded_file)


class PermissionRouteTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.url = "/api/permissions/"
        self.given_permission(
            code="project.edit",
            name="Project edit",
            description="Project edit",
        )
        self.given_permission(
            code="file.view",
            name="File view",
            description="File view",
        )
        self.given_permission(
            code="member.edit",
            name="Member edit",
            description="Member edit",
        )

    # WHEN
    def when_list_permissions(self, query=""):
        return self.api_get(f"{self.url}{query}")

    # ASSERT
    def assert_visible_permission_codes(self, response, expected_codes):
        permissions = self.response_results(response)
        permission_codes = {permission["code"] for permission in permissions}
        self.assertTrue(set(expected_codes).issubset(permission_codes))

    # TESTS GET
    def test_anonymous_cannot_list_permissions(self):
        response = self.when_list_permissions()

        self.assert_unauthorized(response)

    def test_authenticated_user_can_list_permissions(self):
        self.given_authenticated(self.member)

        response = self.when_list_permissions()

        self.assert_ok(response)
        self.assert_visible_permission_codes(
            response,
            ["project.edit", "file.view", "member.edit"],
        )

    def test_list_can_filter_permissions_by_code(self):
        self.given_authenticated(self.member)

        response = self.when_list_permissions("?code=file.view")

        self.assert_ok(response)
        permissions = self.response_results(response)
        permission_codes = {permission["code"] for permission in permissions}
        self.assertEqual(permission_codes, {"file.view"})


class ProjectRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.url = "/api/projects/"
        self.deleted_project = Project.objects.create(
            owner=self.owner,
            name="Deleted project",
        )
        self.deleted_project.soft_delete(self.owner)

    # WHEN
    def when_list_projects(self, query=""):
        return self.api_get(f"{self.url}{query}")

    def when_create_project(self, payload):
        return self.api_post(self.url, payload)

    # ASSERT
    def assert_visible_project_names(self, response, expected_names):
        projects = self.response_results(response)
        project_names = {project["name"] for project in projects}
        self.assertEqual(project_names, set(expected_names))

    def assert_project_exists(self, name, owner):
        return Project.objects.get(name=name, owner=owner)

    def assert_project_does_not_exist(self, name):
        self.assertFalse(Project.objects.filter(name=name).exists())

    # TESTS GET
    def test_anonymous_cannot_list_projects(self):
        response = self.when_list_projects()

        self.assert_unauthorized(response)

    def test_owner_can_list_owned_active_projects_only(self):
        self.given_authenticated(self.owner)

        response = self.when_list_projects()

        self.assert_ok(response)
        self.assert_visible_project_names(response, ["Main project"])

    def test_member_can_list_projects_where_they_are_member(self):
        self.given_member_authenticated([])

        response = self.when_list_projects()

        self.assert_ok(response)
        self.assert_visible_project_names(response, ["Main project"])
        project = self.response_results(response)[0]
        self.assertEqual(project["owner_display_name"], self.owner.username)
        self.assertEqual(project["current_user_permission_codes"], [])

    def test_member_project_list_includes_effective_permission_codes(self):
        self.given_member_authenticated(["project.edit", "task.view"])

        response = self.when_list_projects()

        self.assert_ok(response)
        project = self.response_results(response)[0]
        self.assertEqual(project["current_user_permission_codes"], ["project.edit", "task.view"])

    def test_user_can_list_owned_projects_only_when_not_a_member_elsewhere(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_projects()

        self.assert_ok(response)
        self.assert_visible_project_names(response, ["Other project"])

    def test_list_can_search_projects(self):
        Project.objects.create(
            owner=self.owner,
            name="Search target",
            description="Needle description",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_projects("?search=Needle")

        self.assert_ok(response)
        self.assert_visible_project_names(response, ["Search target"])

    # TESTS POST
    def test_anonymous_cannot_create_project(self):
        response = self.when_create_project({
            "name": "Anonymous project",
        })

        self.assert_unauthorized(response)
        self.assert_project_does_not_exist("Anonymous project")

    def test_authenticated_user_can_create_project(self):
        self.given_authenticated(self.member)

        response = self.when_create_project({
            "name": "Created project",
            "description": "Created project description",
        })

        self.assert_created(response)
        self.assert_project_exists("Created project", self.member)

    def test_create_project_uses_authenticated_user_as_owner(self):
        self.given_authenticated(self.member)

        response = self.when_create_project({
            "owner": self.owner.id,
            "name": "Payload owner ignored",
        })

        self.assert_created(response)
        project = self.assert_project_exists("Payload owner ignored", self.member)
        self.assertEqual(project.owner_id, self.member.id)


class ProjectTrashRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.active_project = Project.objects.create(
            owner=self.owner,
            name="Active project",
        )
        self.deleted_project = Project.objects.create(
            owner=self.owner,
            name="Deleted project",
        )
        self.deleted_project.soft_delete(self.owner)
        self.url = "/api/projects/trash/"

    # WHEN
    def when_list_deleted_projects(self):
        return self.api_get(self.url)

    # ASSERT
    def assert_visible_project_names(self, response, expected_names):
        projects = self.response_results(response)
        project_names = {project["name"] for project in projects}
        self.assertEqual(project_names, set(expected_names))

    # TESTS GET
    def test_anonymous_cannot_list_deleted_projects(self):
        response = self.when_list_deleted_projects()

        self.assert_unauthorized(response)

    def test_owner_can_list_deleted_projects(self):
        self.given_authenticated(self.owner)

        response = self.when_list_deleted_projects()

        self.assert_ok(response)
        self.assert_visible_project_names(response, ["Deleted project"])

    def test_non_owner_cannot_list_deleted_projects_they_cannot_access(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_deleted_projects()

        self.assert_ok(response)
        self.assert_visible_project_names(response, [])


class ProjectRestoreRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.deleted_project = Project.objects.create(
            owner=self.owner,
            name="Deleted project",
        )
        self.deleted_project.soft_delete(self.owner)
        self.url = f"/api/projects/{self.deleted_project.id}/restore/"

    # WHEN
    def when_restore_project(self):
        return self.api_post(self.url, {})

    # ASSERT
    def assert_project_still_deleted(self):
        self.deleted_project.refresh_from_db()
        self.assertIsNotNone(self.deleted_project.deleted_at)

    def assert_project_restored(self):
        self.deleted_project.refresh_from_db()
        self.assertIsNone(self.deleted_project.deleted_at)
        self.assertIsNone(self.deleted_project.deleted_by_id)

    # TESTS POST
    def test_anonymous_cannot_restore_project(self):
        response = self.when_restore_project()

        self.assert_unauthorized(response)
        self.assert_project_still_deleted()

    def test_owner_can_restore_project(self):
        self.given_authenticated(self.owner)

        response = self.when_restore_project()

        self.assert_ok(response)
        self.assert_project_restored()


    def test_member_with_project_edit_cannot_restore_project(self):
        self.given_member_with_permissions(["project.edit"], project=self.deleted_project)
        self.given_authenticated(self.member)

        response = self.when_restore_project()

        self.assert_forbidden(response)
        self.assert_project_still_deleted()

    def test_member_without_project_permission_cannot_restore_project(self):
        self.given_member_with_permissions([], project=self.deleted_project)
        self.given_authenticated(self.member)

        response = self.when_restore_project()

        self.assert_forbidden(response)
        self.assert_project_still_deleted()

class FolderRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.url = f"/api/projects/{self.project.id}/folders/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/folders/"

        self.root_folder = Folder.objects.create(
            project=self.project,
            name="Root folder",
            color="#ff0000",
            icon="folder",
        )

        self.deleted_folder = Folder.objects.create(
            project=self.project,
            name="Deleted folder",
        )
        self.deleted_folder.soft_delete(self.owner)

        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other project folder",
        )

    # WHEN
    def when_list_folders(self, url=None, query=""):
        return self.api_get(f"{url or self.url}{query}")

    def when_create_folder(self, payload, url=None):
        return self.api_post(url or self.url, payload)

    # ASSERT
    def assert_visible_folder_names(self, response, expected_names):
        folders = self.response_results(response)
        folder_names = {folder["name"] for folder in folders}
        self.assertEqual(folder_names, set(expected_names))

    def assert_folder_exists(self, name, project=None, parent_folder=None):
        project = project or self.project

        filters = {
            "project": project,
            "name": name,
        }

        if parent_folder is not None:
            filters["parent_folder"] = parent_folder

        folder = Folder.objects.get(**filters)

        if parent_folder is not None:
            self.assertEqual(folder.parent_folder_id, parent_folder.id)

        return folder

    def assert_folder_does_not_exist(self, name):
        self.assertFalse(
            Folder.objects.filter(name=name).exists()
        )

    # TESTS GET
    def test_anonymous_cannot_list_folders(self):
        response = self.when_list_folders()

        self.assert_unauthorized(response)

    def test_owner_can_list_active_folders(self):
        self.given_authenticated(self.owner)

        response = self.when_list_folders()

        self.assert_ok(response)
        self.assert_visible_folder_names(response, ["Root folder"])

    def test_member_with_folder_view_can_list_folders(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_list_folders()

        self.assert_ok(response)
        self.assert_visible_folder_names(response, ["Root folder"])

    def test_member_without_folder_view_cannot_list_folders(self):
        self.given_member_authenticated(["file.edit"])

        response = self.when_list_folders()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_folders(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_folders()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_folders(self):
        self.given_member_authenticated(["file.view", "file.edit"])

        response = self.when_list_folders(self.other_project_url)

        self.assert_forbidden(response)

    def test_list_can_filter_folders_by_parent_folder(self):
        child_folder = Folder.objects.create(
            project=self.project,
            parent_folder=self.root_folder,
            name="Child folder",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_folders(query=f"?parent_folder={self.root_folder.id}")

        self.assert_ok(response)
        self.assert_visible_folder_names(response, [child_folder.name])

    def test_list_can_search_folders(self):
        Folder.objects.create(
            project=self.project,
            name="Searchable folder",
            description="Needle folder",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_folders(query="?search=Needle")

        self.assert_ok(response)
        self.assert_visible_folder_names(response, ["Searchable folder"])

    # TESTS POST
    def test_anonymous_cannot_create_folder(self):
        response = self.when_create_folder({
            "name": "Anonymous folder",
        })

        self.assert_unauthorized(response)
        self.assert_folder_does_not_exist("Anonymous folder")

    def test_owner_can_create_folder(self):
        self.given_authenticated(self.owner)

        response = self.when_create_folder({
            "name": "Created by owner",
        })

        self.assert_created(response)
        self.assert_folder_exists("Created by owner")

    def test_owner_create_uses_project_from_url_not_payload(self):
        self.given_authenticated(self.owner)

        response = self.when_create_folder({
            "project": self.other_project.id,
            "name": "Created by owner",
        })

        self.assert_created(response)

        folder = self.assert_folder_exists("Created by owner")
        self.assertEqual(folder.project_id, self.project.id)

    def test_member_with_folder_edit_can_create_folder(self):
        self.given_member_authenticated(["file.edit"])

        response = self.when_create_folder({
            "name": "Created by member",
        })

        self.assert_created(response)
        self.assert_folder_exists("Created by member")

    def test_member_without_folder_edit_cannot_create_folder(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_create_folder({
            "name": "Blocked folder",
        })

        self.assert_forbidden(response)
        self.assert_folder_does_not_exist("Blocked folder")

    def test_non_member_cannot_create_folder(self):
        self.given_authenticated(self.other_user)

        response = self.when_create_folder({
            "name": "No membership",
        })

        self.assert_forbidden(response)
        self.assert_folder_does_not_exist("No membership")

    # TESTS VALIDATION
    def test_create_allows_parent_folder_from_same_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_folder({
            "name": "Valid child",
            "parent_folder": self.root_folder.id,
        })

        self.assert_created(response)
        self.assert_folder_exists(
            "Valid child",
            parent_folder=self.root_folder,
        )

    def test_create_allows_same_folder_name_under_different_parent(self):
        other_parent = Folder.objects.create(
            project=self.project,
            name="Other parent",
        )
        Folder.objects.create(
            project=self.project,
            parent_folder=self.root_folder,
            name="Shared child name",
        )
        self.given_authenticated(self.owner)

        response = self.when_create_folder({
            "name": "Shared child name",
            "parent_folder": other_parent.id,
        })

        self.assert_created(response)
        self.assert_folder_exists(
            "Shared child name",
            parent_folder=other_parent,
        )


    def test_create_rejects_duplicate_folder_name_under_same_parent(self):
        Folder.objects.create(
            project=self.project,
            parent_folder=self.root_folder,
            name="Existing child",
        )
        self.given_authenticated(self.owner)

        response = self.when_create_folder({
            "name": "Existing child",
            "parent_folder": self.root_folder.id,
        })

        self.assert_bad_request(response)

    def test_create_rejects_duplicate_root_folder_name(self):
        self.given_authenticated(self.owner)

        response = self.when_create_folder({
            "name": "Root folder",
        })

        self.assert_bad_request(response)

    def test_create_rejects_parent_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_folder({
            "name": "Invalid child",
            "parent_folder": self.other_project_folder.id,
        })

        self.assert_bad_request(response)
        self.assert_folder_does_not_exist("Invalid child")

class FolderTreeRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.url = f"/api/projects/{self.project.id}/folders/tree/"
        self.root_folder = Folder.objects.create(
            project=self.project,
            name="Root folder",
            color="#ff0000",
            icon="folder",
        )
        self.child_folder = Folder.objects.create(
            project=self.project,
            parent_folder=self.root_folder,
            name="Child folder",
        )
        self.root_document = Document.objects.create(
            project=self.project,
            name="Root document",
            file_id="projects/1/documents/root-document.pdf",
            file_name="root-document.pdf",
            file_size=120,
            mime_type="application/pdf",
        )
        self.child_document = Document.objects.create(
            project=self.project,
            folder=self.root_folder,
            name="Child document",
            description="Document inside root folder",
            file_id="projects/1/documents/child-document.pdf",
            file_name="child-document.pdf",
            file_size=240,
            mime_type="application/pdf",
        )
        self.deleted_folder = Folder.objects.create(
            project=self.project,
            name="Deleted folder",
        )
        self.deleted_folder.soft_delete(self.owner)
        self.deleted_document = Document.objects.create(
            project=self.project,
            name="Deleted document",
            file_id="projects/1/documents/deleted-document.pdf",
            file_name="deleted-document.pdf",
            file_size=360,
            mime_type="application/pdf",
        )
        self.deleted_document.soft_delete(self.owner)
        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other project folder",
        )
        self.other_project_document = Document.objects.create(
            project=self.other_project,
            name="Other project document",
            file_id="projects/2/documents/other-project-document.pdf",
            file_name="other-project-document.pdf",
            file_size=480,
            mime_type="application/pdf",
        )

    # WHEN
    def when_get_folder_tree(self):
        return self.api_get(self.url)

    # ASSERT
    def assert_tree_contains_folders_and_documents(self, response):
        tree = self.response_data(response)

        root_nodes_by_name = {node["name"]: node for node in tree}
        self.assertEqual(set(root_nodes_by_name), {"Root document", "Root folder"})

        root_document = root_nodes_by_name["Root document"]
        self.assertEqual(root_document["type"], "document")
        self.assertEqual(root_document["file_name"], "root-document.pdf")
        self.assertEqual(root_document["file_size"], 120)
        self.assertEqual(root_document["mime_type"], "application/pdf")

        root_folder = root_nodes_by_name["Root folder"]
        self.assertEqual(root_folder["type"], "folder")
        self.assertEqual(root_folder["color"], "#ff0000")
        self.assertEqual(root_folder["icon"], "folder")

        child_nodes_by_name = {
            node["name"]: node
            for node in root_folder["children"]
        }
        self.assertEqual(set(child_nodes_by_name), {"Child document", "Child folder"})

        child_document = child_nodes_by_name["Child document"]
        self.assertEqual(child_document["type"], "document")
        self.assertEqual(child_document["description"], "Document inside root folder")
        self.assertEqual(child_document["file_name"], "child-document.pdf")

        child_folder = child_nodes_by_name["Child folder"]
        self.assertEqual(child_folder["type"], "folder")
        self.assertEqual(child_folder["children"], [])

    def assert_tree_excludes_deleted_and_other_project_nodes(self, response):
        def flatten(nodes):
            flattened = []

            for node in nodes:
                flattened.append(node)
                flattened.extend(flatten(node.get("children", [])))

            return flattened

        tree = self.response_data(response)
        node_names = {node["name"] for node in flatten(tree)}
        self.assertNotIn("Deleted folder", node_names)
        self.assertNotIn("Deleted document", node_names)
        self.assertNotIn("Other project folder", node_names)
        self.assertNotIn("Other project document", node_names)

    # TESTS GET
    def test_anonymous_cannot_get_tree(self):
        response = self.when_get_folder_tree()

        self.assert_unauthorized(response)

    def test_owner_can_get_tree_with_documents(self):
        self.given_authenticated(self.owner)

        response = self.when_get_folder_tree()

        self.assert_ok(response)
        self.assert_tree_contains_folders_and_documents(response)
        self.assert_tree_excludes_deleted_and_other_project_nodes(response)

    def test_member_with_folder_view_can_get_tree_with_documents(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_get_folder_tree()

        self.assert_ok(response)
        self.assert_tree_contains_folders_and_documents(response)
        self.assert_tree_excludes_deleted_and_other_project_nodes(response)

    def test_member_without_folder_view_cannot_get_tree(self):
        self.given_member_authenticated(["file.edit"])

        response = self.when_get_folder_tree()

        self.assert_forbidden(response)

    def test_non_member_cannot_get_tree(self):
        self.given_authenticated(self.other_user)

        response = self.when_get_folder_tree()

        self.assert_forbidden(response)


class FolderTargetTreeRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.url = f"/api/projects/{self.project.id}/folders/target-tree/"
        self.root_folder = Folder.objects.create(
            project=self.project,
            name="Root folder",
        )
        self.child_folder = Folder.objects.create(
            project=self.project,
            parent_folder=self.root_folder,
            name="Child folder",
        )
        self.root_task = Task.objects.create(
            project=self.project,
            created_by=self.owner,
            title="Root task",
            status="todo",
        )
        self.child_task = Task.objects.create(
            project=self.project,
            folder=self.child_folder,
            created_by=self.owner,
            title="Child task",
            status="in_progress",
            priority="high",
        )
        self.deleted_task = Task.objects.create(
            project=self.project,
            created_by=self.owner,
            title="Deleted task",
            status="todo",
        )
        self.deleted_task.soft_delete(self.owner)
        self.other_project_task = Task.objects.create(
            project=self.other_project,
            created_by=self.other_user,
            title="Other project task",
            status="todo",
        )

    # WHEN
    def when_get_target_tree(self):
        return self.api_get(self.url)

    # ASSERT
    def flatten_tree(self, nodes):
        flattened = []

        for node in nodes:
            flattened.append(node)
            flattened.extend(self.flatten_tree(node.get("children", [])))

        return flattened

    def assert_target_tree_contains_tasks(self, response):
        tree = self.response_data(response)
        nodes_by_name = {node["name"]: node for node in self.flatten_tree(tree)}

        self.assertEqual(nodes_by_name["Root task"]["type"], "task")
        self.assertEqual(nodes_by_name["Root task"]["status"], "todo")
        self.assertEqual(nodes_by_name["Child task"]["type"], "task")
        self.assertEqual(nodes_by_name["Child task"]["priority"], "high")

        child_folder = nodes_by_name["Child folder"]
        self.assertEqual(
            {node["name"] for node in child_folder["children"]},
            {"Child task"},
        )

    def assert_target_tree_excludes_tasks(self, response):
        tree = self.response_data(response)
        node_names = {node["name"] for node in self.flatten_tree(tree)}

        self.assertIn("Root folder", node_names)
        self.assertIn("Child folder", node_names)
        self.assertNotIn("Root task", node_names)
        self.assertNotIn("Child task", node_names)
        self.assertNotIn("Deleted task", node_names)
        self.assertNotIn("Other project task", node_names)

    # TESTS GET
    def test_anonymous_cannot_get_target_tree(self):
        response = self.when_get_target_tree()

        self.assert_unauthorized(response)

    def test_owner_can_get_target_tree_with_tasks(self):
        self.given_authenticated(self.owner)

        response = self.when_get_target_tree()

        self.assert_ok(response)
        self.assert_target_tree_contains_tasks(response)

    def test_member_with_time_edit_and_task_view_can_get_target_tree_with_tasks(self):
        self.given_member_authenticated(["time_entry.edit", "task.view"])

        response = self.when_get_target_tree()

        self.assert_ok(response)
        self.assert_target_tree_contains_tasks(response)

    def test_member_with_time_edit_without_task_view_gets_folders_only(self):
        self.given_member_authenticated(["time_entry.edit"])

        response = self.when_get_target_tree()

        self.assert_ok(response)
        self.assert_target_tree_excludes_tasks(response)

    def test_member_without_time_edit_cannot_get_target_tree(self):
        self.given_member_authenticated(["task.view"])

        response = self.when_get_target_tree()

        self.assert_forbidden(response)

    def test_non_member_cannot_get_target_tree(self):
        self.given_authenticated(self.other_user)

        response = self.when_get_target_tree()

        self.assert_forbidden(response)


class FolderDetailRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.folder = Folder.objects.create(
            project=self.project,
            name="Target folder",
        )
        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other project folder",
        )
        self.url = f"/api/projects/{self.project.id}/folders/{self.folder.id}/"

    # WHEN
    def when_get_folder(self):
        return self.api_get(self.url)

    def when_patch_folder(self, payload):
        return self.api_patch(self.url, payload)

    def when_delete_folder(self):
        return self.api_delete(self.url)

    # ASSERT
    def assert_folder_name(self, expected_name):
        self.folder.refresh_from_db()
        self.assertEqual(self.folder.name, expected_name)

    def assert_folder_not_deleted(self):
        self.folder.refresh_from_db()
        self.assertIsNone(self.folder.deleted_at)

    def assert_folder_deleted_by(self, user):
        self.folder.refresh_from_db()
        self.assertIsNotNone(self.folder.deleted_at)
        self.assertEqual(self.folder.deleted_by_id, user.id)

    # TESTS GET
    def test_anonymous_cannot_get_folder(self):
        response = self.when_get_folder()

        self.assert_unauthorized(response)

    def test_owner_can_get_folder(self):
        self.given_authenticated(self.owner)

        response = self.when_get_folder()

        self.assert_ok(response)

    def test_member_with_folder_view_can_get_folder(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_get_folder()

        self.assert_ok(response)

    def test_member_without_folder_view_cannot_get_folder(self):
        self.given_member_authenticated([])

        response = self.when_get_folder()

        self.assert_forbidden(response)

    def test_non_member_cannot_get_folder(self):
        self.given_authenticated(self.other_user)

        response = self.when_get_folder()

        self.assert_forbidden(response)

    def test_member_cannot_get_folder_from_another_project(self):
        self.given_member_authenticated(["file.view"])
        self.url = f"/api/projects/{self.other_project.id}/folders/{self.other_project_folder.id}/"

        response = self.when_get_folder()

        self.assert_forbidden(response)

    # TESTS PATCH
    def test_anonymous_cannot_patch_folder(self):
        response = self.when_patch_folder({"name": "Anonymous edit"})

        self.assert_unauthorized(response)
        self.assert_folder_name("Target folder")

    def test_owner_can_patch_folder(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_folder({"name": "Edited by owner"})

        self.assert_ok(response)
        self.assert_folder_name("Edited by owner")
        self.assert_folder_not_deleted()

    def test_member_with_folder_edit_can_patch_folder(self):
        self.given_member_authenticated(["file.edit"])

        response = self.when_patch_folder({"name": "Edited folder"})

        self.assert_ok(response)
        self.assert_folder_name("Edited folder")
        self.assert_folder_not_deleted()

    def test_member_without_folder_edit_cannot_patch_folder(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_patch_folder({"name": "Blocked folder edit"})

        self.assert_forbidden(response)
        self.assert_folder_name("Target folder")
        self.assert_folder_not_deleted()

    def test_non_member_cannot_patch_folder(self):
        self.given_authenticated(self.other_user)

        response = self.when_patch_folder({"name": "Non member edit"})

        self.assert_forbidden(response)
        self.assert_folder_name("Target folder")
        self.assert_folder_not_deleted()

    def test_patch_rejects_circular_parent_folder(self):
        child = Folder.objects.create(
            project=self.project,
            parent_folder=self.folder,
            name="Child folder",
        )
        self.given_authenticated(self.owner)

        response = self.when_patch_folder({
            "parent_folder": child.id,
        })

        self.assert_bad_request(response)
        self.folder.refresh_from_db()
        self.assertIsNone(self.folder.parent_folder_id)

    def test_patch_rejects_parent_folder_as_self(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_folder({
            "parent_folder": self.folder.id,
        })

        self.assert_bad_request(response)
        self.folder.refresh_from_db()
        self.assertIsNone(self.folder.parent_folder_id)

    def test_patch_rejects_parent_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_folder({
            "parent_folder": self.other_project_folder.id,
        })

        self.assert_bad_request(response)
        self.folder.refresh_from_db()
        self.assertIsNone(self.folder.parent_folder_id)

    # TESTS DELETE
    def test_anonymous_cannot_delete_folder(self):
        response = self.when_delete_folder()

        self.assert_unauthorized(response)
        self.assert_folder_not_deleted()

    def test_owner_can_soft_delete_folder(self):
        self.given_authenticated(self.owner)

        response = self.when_delete_folder()

        self.assert_no_content(response)
        self.assert_folder_deleted_by(self.owner)

    def test_member_with_folder_delete_can_soft_delete_folder(self):
        self.given_member_authenticated(["file.delete"])

        response = self.when_delete_folder()

        self.assert_no_content(response)
        self.assert_folder_deleted_by(self.member)

    def test_member_without_folder_delete_cannot_delete_folder(self):
        self.given_member_authenticated(["file.edit"])

        response = self.when_delete_folder()

        self.assert_forbidden(response)
        self.assert_folder_not_deleted()

    def test_non_member_cannot_delete_folder(self):
        self.given_authenticated(self.other_user)

        response = self.when_delete_folder()

        self.assert_forbidden(response)
        self.assert_folder_not_deleted()


class FolderTrashRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.active_folder = Folder.objects.create(
            project=self.project,
            name="Active folder",
        )
        self.deleted_folder = Folder.objects.create(
            project=self.project,
            name="Deleted folder",
        )
        self.deleted_folder.soft_delete(self.owner)
        self.other_project_deleted_folder = Folder.objects.create(
            project=self.other_project,
            name="Other project deleted folder",
        )
        self.other_project_deleted_folder.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/folders/trash/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/folders/trash/"

    # WHEN
    def when_list_deleted_folders(self):
        return self.api_get(self.url)

    # ASSERT
    def assert_visible_folder_names(self, response, expected_names):
        folders = self.response_results(response)
        folder_names = {folder["name"] for folder in folders}
        self.assertEqual(folder_names, set(expected_names))

    # TESTS GET
    def test_anonymous_cannot_list_deleted_folders(self):
        response = self.when_list_deleted_folders()

        self.assert_unauthorized(response)

    def test_owner_can_list_deleted_folders(self):
        self.given_authenticated(self.owner)

        response = self.when_list_deleted_folders()

        self.assert_ok(response)
        self.assert_visible_folder_names(response, ["Deleted folder"])

    def test_member_with_folder_restore_can_list_deleted_folders(self):
        self.given_member_authenticated(["file.restore"])

        response = self.when_list_deleted_folders()

        self.assert_ok(response)
        self.assert_visible_folder_names(response, ["Deleted folder"])

    def test_member_without_folder_restore_cannot_list_deleted_folders(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_list_deleted_folders()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_deleted_folders(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_deleted_folders()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_deleted_folders(self):
        self.given_member_authenticated(["file.view"])
        self.url = self.other_project_url

        response = self.when_list_deleted_folders()

        self.assert_forbidden(response)


class FolderRestoreRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.deleted_folder = Folder.objects.create(
            project=self.project,
            name="Deleted folder",
        )
        self.deleted_folder.soft_delete(self.owner)
        self.other_project_deleted_folder = Folder.objects.create(
            project=self.other_project,
            name="Other project deleted folder",
        )
        self.other_project_deleted_folder.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/folders/{self.deleted_folder.id}/restore/"

    # WHEN
    def when_restore_folder(self):
        return self.api_post(self.url, {})

    # ASSERT
    def assert_folder_still_deleted(self):
        self.deleted_folder.refresh_from_db()
        self.assertIsNotNone(self.deleted_folder.deleted_at)

    def assert_folder_restored(self):
        self.deleted_folder.refresh_from_db()
        self.assertIsNone(self.deleted_folder.deleted_at)
        self.assertIsNone(self.deleted_folder.deleted_by_id)

    # TESTS POST
    def test_anonymous_cannot_restore_folder(self):
        response = self.when_restore_folder()

        self.assert_unauthorized(response)
        self.assert_folder_still_deleted()

    def test_owner_can_restore_folder(self):
        self.given_authenticated(self.owner)

        response = self.when_restore_folder()

        self.assert_ok(response)
        self.assert_folder_restored()

    def test_member_with_folder_restore_can_restore_folder(self):
        self.given_member_authenticated(["file.restore"])

        response = self.when_restore_folder()

        self.assert_ok(response)
        self.assert_folder_restored()

    def test_member_without_folder_restore_cannot_restore_folder(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_restore_folder()

        self.assert_forbidden(response)
        self.assert_folder_still_deleted()

    def test_non_member_cannot_restore_folder(self):
        self.given_authenticated(self.other_user)

        response = self.when_restore_folder()

        self.assert_forbidden(response)
        self.assert_folder_still_deleted()

    def test_member_cannot_restore_folder_from_another_project(self):
        self.given_member_authenticated(["file.restore"])
        self.url = (
            f"/api/projects/{self.other_project.id}/folders/"
            f"{self.other_project_deleted_folder.id}/restore/"
        )

        response = self.when_restore_folder()

        self.assert_forbidden(response)
        self.other_project_deleted_folder.refresh_from_db()
        self.assertIsNotNone(self.other_project_deleted_folder.deleted_at)


class DocumentRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.url = f"/api/projects/{self.project.id}/documents/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/documents/"
        self.folder = Folder.objects.create(
            project=self.project,
            name="Document folder",
        )
        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other project folder",
        )
        self.active_document = Document.objects.create(
            project=self.project,
            folder=self.folder,
            name="Active document",
            file_id="projects/1/documents/active.pdf",
            file_name="active.pdf",
            file_size=100,
            mime_type="application/pdf",
        )
        self.deleted_document = Document.objects.create(
            project=self.project,
            name="Deleted document",
            file_id="projects/1/documents/deleted.pdf",
            file_name="deleted.pdf",
            file_size=200,
            mime_type="application/pdf",
        )
        self.deleted_document.soft_delete(self.owner)
        self.other_project_document = Document.objects.create(
            project=self.other_project,
            name="Other project document",
            file_id="projects/2/documents/other.pdf",
            file_name="other.pdf",
            file_size=300,
            mime_type="application/pdf",
        )

    # GIVEN
    def given_uploaded_pdf(self, name="created.pdf", content=b"pdf"):
        return SimpleUploadedFile(
            name,
            content,
            content_type="application/pdf",
        )

    def given_upload_metadata(self, name="created.pdf"):
        return {
            "file_id": f"projects/{self.project.id}/documents/{name}",
            "file_name": name,
            "file_size": 3,
            "mime_type": "application/pdf",
        }

    # WHEN
    def when_list_documents(self, url=None, query=""):
        return self.api_get(f"{url or self.url}{query}")

    def when_create_document(self, payload, url=None):
        return self.client.post(url or self.url, payload)

    # ASSERT
    def assert_visible_document_names(self, response, expected_names):
        documents = self.response_results(response)
        document_names = {document["name"] for document in documents}
        self.assertEqual(document_names, set(expected_names))

    def assert_document_exists(self, name, project=None, folder=None):
        project = project or self.project
        document = Document.objects.get(project=project, name=name)
        if folder is not None:
            self.assertEqual(document.folder_id, folder.id)
        return document

    def assert_document_does_not_exist(self, name):
        self.assertFalse(Document.objects.filter(name=name).exists())

    # TESTS GET
    def test_anonymous_cannot_list_documents(self):
        response = self.when_list_documents()

        self.assert_unauthorized(response)

    def test_owner_can_list_active_documents(self):
        self.given_authenticated(self.owner)

        response = self.when_list_documents()

        self.assert_ok(response)
        self.assert_visible_document_names(response, ["Active document"])

    def test_member_with_document_view_can_list_documents(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_list_documents()

        self.assert_ok(response)
        self.assert_visible_document_names(response, ["Active document"])

    def test_member_without_document_view_cannot_list_documents(self):
        self.given_member_authenticated(["file.edit"])

        response = self.when_list_documents()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_documents(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_documents()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_documents(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_list_documents(self.other_project_url)

        self.assert_forbidden(response)

    def test_list_can_filter_documents_by_folder(self):
        self.given_authenticated(self.owner)

        response = self.when_list_documents(query=f"?folder={self.folder.id}")

        self.assert_ok(response)
        self.assert_visible_document_names(response, ["Active document"])

    def test_list_can_search_documents_by_file_name(self):
        self.given_authenticated(self.owner)

        response = self.when_list_documents(query="?search=active.pdf")

        self.assert_ok(response)
        self.assert_visible_document_names(response, ["Active document"])

    # TESTS POST
    def test_anonymous_cannot_create_document(self):
        response = self.when_create_document({
            "name": "Anonymous document",
            "file": self.given_uploaded_pdf(),
        })

        self.assert_unauthorized(response)
        self.assert_document_does_not_exist("Anonymous document")

    @patch("api.views.documents.upload_document_file")
    def test_owner_can_create_document(self, upload_document_file):
        upload_document_file.return_value = self.given_upload_metadata()
        self.given_authenticated(self.owner)

        response = self.when_create_document({
            "name": "Created document",
            "description": "Created description",
            "folder": self.folder.id,
            "file": self.given_uploaded_pdf(),
        })

        self.assert_created(response)
        document = self.assert_document_exists(
            "Created document",
            folder=self.folder,
        )
        self.assertEqual(document.description, "Created description")
        self.assertEqual(document.file_name, "created.pdf")
        upload_document_file.assert_called_once()

    @patch("api.views.documents.upload_document_file")
    def test_member_with_document_edit_can_create_document(self, upload_document_file):
        upload_document_file.return_value = self.given_upload_metadata()
        self.given_member_authenticated(["file.edit"])

        response = self.when_create_document({
            "name": "Created by member",
            "file": self.given_uploaded_pdf(),
        })

        self.assert_created(response)
        self.assert_document_exists("Created by member")

    @patch("api.views.documents.upload_document_file")
    def test_member_without_document_edit_cannot_create_document(self, upload_document_file):
        self.given_member_authenticated(["file.view"])

        response = self.when_create_document({
            "name": "Blocked document",
            "file": self.given_uploaded_pdf(),
        })

        self.assert_forbidden(response)
        self.assert_document_does_not_exist("Blocked document")
        upload_document_file.assert_not_called()

    @patch("api.views.documents.upload_document_file")
    def test_non_member_cannot_create_document(self, upload_document_file):
        self.given_authenticated(self.other_user)

        response = self.when_create_document({
            "name": "Non member document",
            "file": self.given_uploaded_pdf(),
        })

        self.assert_forbidden(response)
        self.assert_document_does_not_exist("Non member document")
        upload_document_file.assert_not_called()

    @patch("api.views.documents.upload_document_file")
    def test_create_document_uses_file_name_when_name_missing(self, upload_document_file):
        upload_document_file.return_value = self.given_upload_metadata("fallback.pdf")
        self.given_authenticated(self.owner)

        response = self.when_create_document({
            "file": self.given_uploaded_pdf("fallback.pdf"),
        })

        self.assert_created(response)
        self.assert_document_exists("fallback.pdf")

    @patch("api.views.documents.upload_document_file")
    def test_create_rejects_folder_from_another_project(self, upload_document_file):
        self.given_authenticated(self.owner)

        response = self.when_create_document({
            "name": "Invalid folder document",
            "folder": self.other_project_folder.id,
            "file": self.given_uploaded_pdf(),
        })

        self.assert_bad_request(response)
        self.assert_document_does_not_exist("Invalid folder document")
        upload_document_file.assert_not_called()

    @patch("api.views.documents.upload_document_file")
    def test_create_rejects_missing_file(self, upload_document_file):
        self.given_authenticated(self.owner)

        response = self.when_create_document({
            "name": "Missing file",
        })

        self.assert_bad_request(response)
        self.assert_document_does_not_exist("Missing file")
        upload_document_file.assert_not_called()

class DocumentDetailRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.folder = Folder.objects.create(
            project=self.project,
            name="Document folder",
        )
        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other project folder",
        )
        self.document = Document.objects.create(
            project=self.project,
            folder=self.folder,
            name="Target document",
            file_id="projects/1/documents/target.pdf",
            file_name="target.pdf",
            file_size=100,
            mime_type="application/pdf",
        )
        self.other_project_document = Document.objects.create(
            project=self.other_project,
            name="Other project document",
            file_id="projects/2/documents/other.pdf",
            file_name="other.pdf",
            file_size=200,
            mime_type="application/pdf",
        )
        self.url = f"/api/projects/{self.project.id}/documents/{self.document.id}/"

    # WHEN
    def when_get_document(self):
        return self.api_get(self.url)

    def when_patch_document(self, payload):
        return self.api_patch(self.url, payload)

    def when_delete_document(self):
        return self.api_delete(self.url)

    # ASSERT
    def assert_document_name(self, expected_name):
        self.document.refresh_from_db()
        self.assertEqual(self.document.name, expected_name)

    def assert_document_not_deleted(self):
        self.document.refresh_from_db()
        self.assertIsNone(self.document.deleted_at)

    def assert_document_deleted_by(self, user):
        self.document.refresh_from_db()
        self.assertIsNotNone(self.document.deleted_at)
        self.assertEqual(self.document.deleted_by_id, user.id)

    # TESTS GET
    def test_anonymous_cannot_get_document(self):
        response = self.when_get_document()

        self.assert_unauthorized(response)

    def test_owner_can_get_document(self):
        self.given_authenticated(self.owner)

        response = self.when_get_document()

        self.assert_ok(response)

    def test_member_with_document_view_can_get_document(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_get_document()

        self.assert_ok(response)

    def test_member_without_document_view_cannot_get_document(self):
        self.given_member_authenticated([])

        response = self.when_get_document()

        self.assert_forbidden(response)

    def test_non_member_cannot_get_document(self):
        self.given_authenticated(self.other_user)

        response = self.when_get_document()

        self.assert_forbidden(response)

    def test_member_cannot_get_document_from_another_project(self):
        self.given_member_authenticated(["file.view"])
        self.url = f"/api/projects/{self.other_project.id}/documents/{self.other_project_document.id}/"

        response = self.when_get_document()

        self.assert_forbidden(response)

    # TESTS PATCH
    def test_anonymous_cannot_patch_document(self):
        response = self.when_patch_document({"name": "Anonymous edit"})

        self.assert_unauthorized(response)
        self.assert_document_name("Target document")

    def test_owner_can_patch_document(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_document({"name": "Edited by owner"})

        self.assert_ok(response)
        self.assert_document_name("Edited by owner")
        self.assert_document_not_deleted()

    def test_member_with_document_edit_can_patch_document(self):
        self.given_member_authenticated(["file.edit"])

        response = self.when_patch_document({"name": "Edited document"})

        self.assert_ok(response)
        self.assert_document_name("Edited document")
        self.assert_document_not_deleted()

    def test_member_without_document_edit_cannot_patch_document(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_patch_document({"name": "Blocked edit"})

        self.assert_forbidden(response)
        self.assert_document_name("Target document")
        self.assert_document_not_deleted()

    def test_patch_rejects_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_document({
            "folder": self.other_project_folder.id,
        })

        self.assert_bad_request(response)
        self.document.refresh_from_db()
        self.assertEqual(self.document.folder_id, self.folder.id)

    # TESTS DELETE
    def test_anonymous_cannot_delete_document(self):
        response = self.when_delete_document()

        self.assert_unauthorized(response)
        self.assert_document_not_deleted()

    def test_owner_can_soft_delete_document(self):
        self.given_authenticated(self.owner)

        response = self.when_delete_document()

        self.assert_no_content(response)
        self.assert_document_deleted_by(self.owner)


    def test_member_with_document_delete_can_soft_delete_document(self):
        self.given_member_authenticated(["file.delete"])

        response = self.when_delete_document()

        self.assert_no_content(response)
        self.assert_document_deleted_by(self.member)

    def test_member_without_document_delete_cannot_delete_document(self):
        self.given_member_authenticated(["file.edit"])

        response = self.when_delete_document()

        self.assert_forbidden(response)
        self.assert_document_not_deleted()

class DocumentDownloadRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.document = Document.objects.create(
            project=self.project,
            name="Download document",
            file_id="projects/1/documents/download.pdf",
            file_name="download.pdf",
            file_size=100,
            mime_type="application/pdf",
        )
        self.other_project_document = Document.objects.create(
            project=self.other_project,
            name="Other project download document",
            file_id="projects/2/documents/download.pdf",
            file_name="download.pdf",
            file_size=200,
            mime_type="application/pdf",
        )
        self.url = f"/api/projects/{self.project.id}/documents/{self.document.id}/download/"

    # WHEN
    def when_download_document(self):
        return self.api_get(self.url)

    # TESTS GET
    @patch("api.serializers.get_document_download_url")
    def test_anonymous_cannot_get_document_download_url(self, get_document_download_url):
        response = self.when_download_document()

        self.assert_unauthorized(response)
        get_document_download_url.assert_not_called()

    @patch("api.serializers.get_document_download_url")
    def test_owner_can_get_document_download_url(self, get_document_download_url):
        get_document_download_url.return_value = "https://storage.example/download.pdf"
        self.given_authenticated(self.owner)

        response = self.when_download_document()

        self.assert_ok(response)
        data = self.response_data(response)
        self.assertEqual(data["url"], "https://storage.example/download.pdf")
        self.assertEqual(data["file_name"], "download.pdf")
        self.assertEqual(data["mime_type"], "application/pdf")

    @patch("api.serializers.get_document_download_url")
    def test_member_with_document_view_can_get_document_download_url(self, get_document_download_url):
        get_document_download_url.return_value = "https://storage.example/download.pdf"
        self.given_member_authenticated(["file.view"])

        response = self.when_download_document()

        self.assert_ok(response)

    @patch("api.serializers.get_document_download_url")
    def test_member_without_document_view_cannot_get_document_download_url(self, get_document_download_url):
        self.given_member_authenticated(["file.edit"])

        response = self.when_download_document()

        self.assert_forbidden(response)
        get_document_download_url.assert_not_called()

    @patch("api.serializers.get_document_download_url")
    def test_non_member_cannot_get_document_download_url(self, get_document_download_url):
        self.given_authenticated(self.other_user)

        response = self.when_download_document()

        self.assert_forbidden(response)
        get_document_download_url.assert_not_called()

    @patch("api.serializers.get_document_download_url")
    def test_member_cannot_get_document_download_url_from_another_project(self, get_document_download_url):
        self.given_member_authenticated(["file.view"])
        self.url = (
            f"/api/projects/{self.other_project.id}/documents/"
            f"{self.other_project_document.id}/download/"
        )

        response = self.when_download_document()

        self.assert_forbidden(response)
        get_document_download_url.assert_not_called()

class DocumentDownloadBatchRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.document = Document.objects.create(
            project=self.project,
            name="Download document",
            file_id="projects/1/documents/download.pdf",
            file_name="download.pdf",
            file_size=100,
            mime_type="application/pdf",
        )
        self.other_project_document = Document.objects.create(
            project=self.other_project,
            name="Other project download document",
            file_id="projects/2/documents/download.pdf",
            file_name="download.pdf",
            file_size=200,
            mime_type="application/pdf",
        )
        self.url = f"/api/projects/{self.project.id}/documents/download-urls/"

    # WHEN
    def when_download_documents_batch(self, ids):
        return self.api_post(self.url, {"ids": ids})

    # TESTS POST
    @patch("api.serializers.get_document_download_url")
    def test_anonymous_cannot_get_document_download_urls_batch(self, get_document_download_url):
        response = self.when_download_documents_batch([self.document.id])

        self.assert_unauthorized(response)
        get_document_download_url.assert_not_called()

    @patch("api.serializers.get_document_download_url")
    def test_owner_can_get_document_download_urls_batch(self, get_document_download_url):
        get_document_download_url.return_value = "https://storage.example/download.pdf"
        self.given_authenticated(self.owner)

        response = self.when_download_documents_batch([self.document.id])

        self.assert_ok(response)
        data = self.response_data(response)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], self.document.id)
        self.assertEqual(data[0]["url"], "https://storage.example/download.pdf")
        self.assertEqual(data[0]["file_name"], "download.pdf")
        self.assertEqual(data[0]["mime_type"], "application/pdf")

    @patch("api.serializers.get_document_download_url")
    def test_member_with_document_view_can_get_document_download_urls_batch(self, get_document_download_url):
        get_document_download_url.return_value = "https://storage.example/download.pdf"
        self.given_member_authenticated(["file.view"])

        response = self.when_download_documents_batch([self.document.id])

        self.assert_ok(response)

    @patch("api.serializers.get_document_download_url")
    def test_member_without_document_view_cannot_get_document_download_urls_batch(self, get_document_download_url):
        self.given_member_authenticated(["file.edit"])

        response = self.when_download_documents_batch([self.document.id])

        self.assert_forbidden(response)
        get_document_download_url.assert_not_called()

    @patch("api.serializers.get_document_download_url")
    def test_download_urls_batch_ignores_documents_from_another_project(self, get_document_download_url):
        get_document_download_url.return_value = "https://storage.example/download.pdf"
        self.given_member_authenticated(["file.view"])

        response = self.when_download_documents_batch([self.document.id, self.other_project_document.id])

        self.assert_ok(response)
        data = self.response_data(response)
        self.assertEqual([item["id"] for item in data], [self.document.id])


class DocumentTrashRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.active_document = Document.objects.create(
            project=self.project,
            name="Active document",
            file_id="projects/1/documents/active-trash.pdf",
            file_name="active-trash.pdf",
            file_size=100,
            mime_type="application/pdf",
        )
        self.deleted_document = Document.objects.create(
            project=self.project,
            name="Deleted document",
            file_id="projects/1/documents/deleted-trash.pdf",
            file_name="deleted-trash.pdf",
            file_size=200,
            mime_type="application/pdf",
        )
        self.deleted_document.soft_delete(self.owner)
        self.other_project_deleted_document = Document.objects.create(
            project=self.other_project,
            name="Other project deleted document",
            file_id="projects/2/documents/deleted-trash.pdf",
            file_name="deleted-trash.pdf",
            file_size=300,
            mime_type="application/pdf",
        )
        self.other_project_deleted_document.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/documents/trash/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/documents/trash/"

    # WHEN
    def when_list_deleted_documents(self):
        return self.api_get(self.url)

    # ASSERT
    def assert_visible_document_names(self, response, expected_names):
        documents = self.response_results(response)
        document_names = {document["name"] for document in documents}
        self.assertEqual(document_names, set(expected_names))

    # TESTS GET
    def test_anonymous_cannot_list_deleted_documents(self):
        response = self.when_list_deleted_documents()

        self.assert_unauthorized(response)

    def test_owner_can_list_deleted_documents(self):
        self.given_authenticated(self.owner)

        response = self.when_list_deleted_documents()

        self.assert_ok(response)
        self.assert_visible_document_names(response, ["Deleted document"])

    def test_member_with_document_restore_can_list_deleted_documents(self):
        self.given_member_authenticated(["file.restore"])

        response = self.when_list_deleted_documents()

        self.assert_ok(response)
        self.assert_visible_document_names(response, ["Deleted document"])

    def test_member_without_document_restore_cannot_list_deleted_documents(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_list_deleted_documents()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_deleted_documents(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_deleted_documents()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_deleted_documents(self):
        self.given_member_authenticated(["file.view"])
        self.url = self.other_project_url

        response = self.when_list_deleted_documents()

        self.assert_forbidden(response)

class DocumentRestoreRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.deleted_document = Document.objects.create(
            project=self.project,
            name="Deleted document",
            file_id="projects/1/documents/deleted-restore.pdf",
            file_name="deleted-restore.pdf",
            file_size=200,
            mime_type="application/pdf",
        )
        self.deleted_document.soft_delete(self.owner)
        self.other_project_deleted_document = Document.objects.create(
            project=self.other_project,
            name="Other project deleted document",
            file_id="projects/2/documents/deleted-restore.pdf",
            file_name="deleted-restore.pdf",
            file_size=300,
            mime_type="application/pdf",
        )
        self.other_project_deleted_document.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/documents/{self.deleted_document.id}/restore/"

    # WHEN
    def when_restore_document(self):
        return self.api_post(self.url, {})

    # ASSERT
    def assert_document_still_deleted(self):
        self.deleted_document.refresh_from_db()
        self.assertIsNotNone(self.deleted_document.deleted_at)

    def assert_document_restored(self):
        self.deleted_document.refresh_from_db()
        self.assertIsNone(self.deleted_document.deleted_at)
        self.assertIsNone(self.deleted_document.deleted_by_id)

    # TESTS POST
    def test_anonymous_cannot_restore_document(self):
        response = self.when_restore_document()

        self.assert_unauthorized(response)
        self.assert_document_still_deleted()

    def test_owner_can_restore_document(self):
        self.given_authenticated(self.owner)

        response = self.when_restore_document()

        self.assert_ok(response)
        self.assert_document_restored()

    def test_member_with_document_restore_can_restore_document(self):
        self.given_member_authenticated(["file.restore"])

        response = self.when_restore_document()

        self.assert_ok(response)
        self.assert_document_restored()

    def test_member_without_document_restore_cannot_restore_document(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_restore_document()

        self.assert_forbidden(response)
        self.assert_document_still_deleted()

    def test_non_member_cannot_restore_document(self):
        self.given_authenticated(self.other_user)

        response = self.when_restore_document()

        self.assert_forbidden(response)
        self.assert_document_still_deleted()

    def test_member_cannot_restore_document_from_another_project(self):
        self.given_member_authenticated(["file.restore"])
        self.url = (
            f"/api/projects/{self.other_project.id}/documents/"
            f"{self.other_project_deleted_document.id}/restore/"
        )

        response = self.when_restore_document()

        self.assert_forbidden(response)
        self.other_project_deleted_document.refresh_from_db()
        self.assertIsNotNone(self.other_project_deleted_document.deleted_at)


class TaskRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.folder = Folder.objects.create(
            project=self.project,
            name="Task folder",
        )
        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other task folder",
        )
        self.assignee = User.objects.create_user(
            username="assignee",
            email="assignee@example.com",
        )
        self.given_member_with_permissions([], user=self.assignee)
        self.task = Task.objects.create(
            project=self.project,
            folder=self.folder,
            created_by=self.owner,
            title="Visible task",
            description="Urgent task in folder",
            status="todo",
        )
        self.task.assigned_to.add(self.assignee)
        self.other_folder_task = Task.objects.create(
            project=self.project,
            created_by=self.owner,
            title="Root task",
            description="Backlog item",
            status="done",
        )
        self.deleted_task = Task.objects.create(
            project=self.project,
            created_by=self.owner,
            title="Deleted task",
            status="todo",
        )
        self.deleted_task.soft_delete(self.owner)
        self.other_project_task = Task.objects.create(
            project=self.other_project,
            created_by=self.other_user,
            title="Other project task",
            status="todo",
        )
        self.url = f"/api/projects/{self.project.id}/tasks/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/tasks/"

    # WHEN
    def when_list_tasks(self, query=""):
        return self.api_get(f"{self.url}{query}")

    def when_create_task(self, payload):
        return self.api_post(self.url, payload)

    # ASSERT
    def assert_visible_task_titles(self, response, expected_titles):
        tasks = self.response_results(response)
        task_titles = {task["title"] for task in tasks}
        self.assertEqual(task_titles, set(expected_titles))

    def assert_task_exists(self, title):
        return Task.objects.get(project=self.project, title=title)

    def assert_task_does_not_exist(self, title):
        self.assertFalse(Task.objects.filter(project=self.project, title=title).exists())

    # TESTS GET
    def test_anonymous_cannot_list_tasks(self):
        response = self.when_list_tasks()

        self.assert_unauthorized(response)

    def test_owner_can_list_active_project_tasks_only(self):
        self.given_authenticated(self.owner)

        response = self.when_list_tasks()

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Visible task", "Root task"])

    def test_member_with_task_view_can_list_tasks(self):
        self.given_member_authenticated(["task.view"])

        response = self.when_list_tasks()

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Visible task", "Root task"])

    def test_member_without_task_view_cannot_list_tasks(self):
        self.given_member_authenticated(["task.edit"])

        response = self.when_list_tasks()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_tasks(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_tasks()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_tasks(self):
        self.given_member_authenticated(["task.view", "task.edit"])
        self.url = self.other_project_url

        response = self.when_list_tasks()

        self.assert_forbidden(response)

    def test_list_can_filter_by_folder(self):
        self.given_authenticated(self.owner)

        response = self.when_list_tasks(f"?folder={self.folder.id}")

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Visible task"])

    def test_list_can_filter_by_status(self):
        self.given_authenticated(self.owner)

        response = self.when_list_tasks("?status=done")

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Root task"])

    def test_list_can_filter_by_priority(self):
        Task.objects.create(
            project=self.project,
            created_by=self.owner,
            title="High priority task",
            priority="high",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_tasks("?priority=high")

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["High priority task"])

    def test_list_can_filter_by_assigned_to(self):
        self.given_authenticated(self.owner)

        response = self.when_list_tasks(f"?assigned_to={self.assignee.id}")

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Visible task"])

    def test_list_can_search_by_title(self):
        self.given_authenticated(self.owner)

        response = self.when_list_tasks("?search=Root")

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Root task"])

    def test_list_can_search_by_description(self):
        self.given_authenticated(self.owner)

        response = self.when_list_tasks("?search=Urgent")

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Visible task"])

    def test_list_can_combine_filters_and_search(self):
        self.given_authenticated(self.owner)

        response = self.when_list_tasks(
            f"?folder={self.folder.id}&status=todo&assigned_to={self.assignee.id}&search=Urgent"
        )

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Visible task"])

    # TESTS POST
    def test_anonymous_cannot_create_task(self):
        response = self.when_create_task({
            "title": "Anonymous task",
        })

        self.assert_unauthorized(response)
        self.assert_task_does_not_exist("Anonymous task")

    def test_owner_can_create_task_with_assignees(self):
        self.given_member_with_permissions([], user=self.member)
        self.given_authenticated(self.owner)

        response = self.when_create_task({
            "folder": self.folder.id,
            "assigned_to": [self.member.id],
            "title": "Created task",
            "description": "Created description",
            "status": "todo",
            "priority": "high",
        })

        self.assert_created(response)
        task = self.assert_task_exists("Created task")
        self.assertEqual(task.created_by_id, self.owner.id)
        self.assertEqual(task.assigned_to.get().id, self.member.id)

    def test_member_with_task_edit_can_create_task(self):
        self.given_member_authenticated(["task.edit"])

        response = self.when_create_task({
            "folder": self.folder.id,
            "title": "Member task",
        })

        self.assert_created(response)
        task = self.assert_task_exists("Member task")
        self.assertEqual(task.created_by_id, self.member.id)

    def test_member_without_task_edit_cannot_create_task(self):
        self.given_member_authenticated(["task.view"])

        response = self.when_create_task({
            "title": "Blocked task",
        })

        self.assert_forbidden(response)
        self.assert_task_does_not_exist("Blocked task")

    def test_non_member_cannot_create_task(self):
        self.given_authenticated(self.other_user)

        response = self.when_create_task({
            "title": "Non member task",
        })

        self.assert_forbidden(response)
        self.assert_task_does_not_exist("Non member task")

    def test_create_rejects_assignee_outside_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_task({
            "assigned_to": [self.other_user.id],
            "title": "Invalid assignee task",
        })

        self.assert_bad_request(response)
        self.assert_task_does_not_exist("Invalid assignee task")


    def test_create_rejects_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_task({
            "folder": self.other_project_folder.id,
            "title": "Invalid folder task",
        })

        self.assert_bad_request(response)
        self.assert_task_does_not_exist("Invalid folder task")

class TaskDetailRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.folder = Folder.objects.create(
            project=self.project,
            name="Task detail folder",
        )
        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other project folder",
        )
        self.assignee = User.objects.create_user(
            username="detail-assignee",
            email="detail-assignee@example.com",
        )
        self.given_member_with_permissions([], user=self.assignee)
        self.task = Task.objects.create(
            project=self.project,
            folder=self.folder,
            created_by=self.owner,
            title="Target task",
        )
        self.other_project_task = Task.objects.create(
            project=self.other_project,
            created_by=self.other_user,
            title="Other project task",
        )
        self.url = f"/api/projects/{self.project.id}/tasks/{self.task.id}/"

    # WHEN
    def when_get_task(self):
        return self.api_get(self.url)

    def when_patch_task(self, payload):
        return self.api_patch(self.url, payload)

    def when_delete_task(self):
        return self.api_delete(self.url)

    # ASSERT
    def assert_task_title(self, expected_title):
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, expected_title)

    def assert_task_not_deleted(self):
        self.task.refresh_from_db()
        self.assertIsNone(self.task.deleted_at)

    def assert_task_deleted_by(self, user):
        self.task.refresh_from_db()
        self.assertIsNotNone(self.task.deleted_at)
        self.assertEqual(self.task.deleted_by_id, user.id)

    # TESTS GET
    def test_anonymous_cannot_get_task(self):
        response = self.when_get_task()

        self.assert_unauthorized(response)

    def test_owner_can_get_task(self):
        self.given_authenticated(self.owner)

        response = self.when_get_task()

        self.assert_ok(response)

    def test_member_with_task_view_can_get_task(self):
        self.given_member_authenticated(["task.view"])

        response = self.when_get_task()

        self.assert_ok(response)

    def test_member_without_task_view_cannot_get_task(self):
        self.given_member_authenticated([])

        response = self.when_get_task()

        self.assert_forbidden(response)

    def test_non_member_cannot_get_task(self):
        self.given_authenticated(self.other_user)

        response = self.when_get_task()

        self.assert_forbidden(response)

    def test_member_cannot_get_task_from_another_project(self):
        self.given_member_authenticated(["task.view"])
        self.url = f"/api/projects/{self.other_project.id}/tasks/{self.other_project_task.id}/"

        response = self.when_get_task()

        self.assert_forbidden(response)

    # TESTS PATCH
    def test_anonymous_cannot_patch_task(self):
        response = self.when_patch_task({"title": "Anonymous edit"})

        self.assert_unauthorized(response)
        self.assert_task_title("Target task")

    def test_owner_can_patch_task(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_task({"title": "Owner edited task"})

        self.assert_ok(response)
        self.assert_task_title("Owner edited task")

    def test_member_with_task_edit_can_patch_task(self):
        self.given_member_authenticated(["task.edit"])

        response = self.when_patch_task({"title": "Edited task"})

        self.assert_ok(response)
        self.assert_task_title("Edited task")

    def test_member_without_task_edit_cannot_patch_task(self):
        self.given_member_authenticated(["task.view"])

        response = self.when_patch_task({"title": "Blocked edit"})

        self.assert_forbidden(response)
        self.assert_task_title("Target task")

    def test_patch_can_update_assignees(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_task({"assigned_to": [self.assignee.id]})

        self.assert_ok(response)
        self.task.refresh_from_db()
        self.assertEqual(list(self.task.assigned_to.values_list("id", flat=True)), [self.assignee.id])

    def test_patch_rejects_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_task({"folder": self.other_project_folder.id})

        self.assert_bad_request(response)
        self.task.refresh_from_db()
        self.assertEqual(self.task.folder_id, self.folder.id)

    # TESTS DELETE
    def test_anonymous_cannot_delete_task(self):
        response = self.when_delete_task()

        self.assert_unauthorized(response)
        self.assert_task_not_deleted()

    def test_owner_can_soft_delete_task(self):
        self.given_authenticated(self.owner)

        response = self.when_delete_task()

        self.assert_no_content(response)
        self.assert_task_deleted_by(self.owner)


    def test_member_with_task_delete_can_soft_delete_task(self):
        self.given_member_authenticated(["task.delete"])

        response = self.when_delete_task()

        self.assert_no_content(response)
        self.assert_task_deleted_by(self.member)

    def test_member_without_task_delete_cannot_delete_task(self):
        self.given_member_authenticated(["task.edit"])

        response = self.when_delete_task()

        self.assert_forbidden(response)
        self.assert_task_not_deleted()

class TaskTrashRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.active_task = Task.objects.create(
            project=self.project,
            created_by=self.owner,
            title="Active task",
        )
        self.deleted_task = Task.objects.create(
            project=self.project,
            created_by=self.owner,
            title="Deleted task",
        )
        self.deleted_task.soft_delete(self.owner)
        self.other_project_deleted_task = Task.objects.create(
            project=self.other_project,
            created_by=self.other_user,
            title="Other project deleted task",
        )
        self.other_project_deleted_task.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/tasks/trash/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/tasks/trash/"

    # WHEN
    def when_list_deleted_tasks(self):
        return self.api_get(self.url)

    # ASSERT
    def assert_visible_task_titles(self, response, expected_titles):
        tasks = self.response_results(response)
        task_titles = {task["title"] for task in tasks}
        self.assertEqual(task_titles, set(expected_titles))

    # TESTS GET
    def test_anonymous_cannot_list_deleted_tasks(self):
        response = self.when_list_deleted_tasks()

        self.assert_unauthorized(response)

    def test_owner_can_list_deleted_tasks(self):
        self.given_authenticated(self.owner)

        response = self.when_list_deleted_tasks()

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Deleted task"])

    def test_member_with_task_restore_can_list_deleted_tasks(self):
        self.given_member_authenticated(["task.restore"])

        response = self.when_list_deleted_tasks()

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Deleted task"])

    def test_member_without_task_restore_cannot_list_deleted_tasks(self):
        self.given_member_authenticated(["task.view"])

        response = self.when_list_deleted_tasks()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_deleted_tasks(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_deleted_tasks()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_deleted_tasks(self):
        self.given_member_authenticated(["task.view"])
        self.url = self.other_project_url

        response = self.when_list_deleted_tasks()

        self.assert_forbidden(response)


class TaskRestoreRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.deleted_task = Task.objects.create(
            project=self.project,
            created_by=self.owner,
            title="Deleted task",
        )
        self.deleted_task.soft_delete(self.owner)
        self.other_project_deleted_task = Task.objects.create(
            project=self.other_project,
            created_by=self.other_user,
            title="Other project deleted task",
        )
        self.other_project_deleted_task.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/tasks/{self.deleted_task.id}/restore/"

    # WHEN
    def when_restore_task(self):
        return self.api_post(self.url, {})

    # ASSERT
    def assert_task_still_deleted(self):
        self.deleted_task.refresh_from_db()
        self.assertIsNotNone(self.deleted_task.deleted_at)

    def assert_task_restored(self):
        self.deleted_task.refresh_from_db()
        self.assertIsNone(self.deleted_task.deleted_at)
        self.assertIsNone(self.deleted_task.deleted_by_id)

    # TESTS POST
    def test_anonymous_cannot_restore_task(self):
        response = self.when_restore_task()

        self.assert_unauthorized(response)
        self.assert_task_still_deleted()

    def test_owner_can_restore_task(self):
        self.given_authenticated(self.owner)

        response = self.when_restore_task()

        self.assert_ok(response)
        self.assert_task_restored()

    def test_member_with_task_restore_can_restore_task(self):
        self.given_member_authenticated(["task.restore"])

        response = self.when_restore_task()

        self.assert_ok(response)
        self.assert_task_restored()

    def test_member_without_task_restore_cannot_restore_task(self):
        self.given_member_authenticated(["task.view"])

        response = self.when_restore_task()

        self.assert_forbidden(response)
        self.assert_task_still_deleted()

    def test_non_member_cannot_restore_task(self):
        self.given_authenticated(self.other_user)

        response = self.when_restore_task()

        self.assert_forbidden(response)
        self.assert_task_still_deleted()

    def test_member_cannot_restore_task_from_another_project(self):
        self.given_member_authenticated(["task.restore"])
        self.url = (
            f"/api/projects/{self.other_project.id}/tasks/"
            f"{self.other_project_deleted_task.id}/restore/"
        )

        response = self.when_restore_task()

        self.assert_forbidden(response)
        self.other_project_deleted_task.refresh_from_db()
        self.assertIsNotNone(self.other_project_deleted_task.deleted_at)


class DayEntryRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.folder = Folder.objects.create(
            project=self.project,
            name="Day entry folder",
        )
        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other day entry folder",
        )
        self.worker_a = User.objects.create_user(username="worker-a", email="worker-a@example.com")
        self.worker_b = User.objects.create_user(username="worker-b", email="worker-b@example.com")
        self.given_member_with_permissions([], user=self.worker_a)
        self.given_member_with_permissions([], user=self.worker_b)
        self.document = Document.objects.create(
            project=self.project,
            folder=self.folder,
            name="Photo chantier",
            file_id="day-entry-doc",
            file_name="photo.jpg",
        )
        self.url = f"/api/projects/{self.project.id}/day-entries/"

    # GIVEN
    def default_payload(self, **overrides):
        payload = {
            "title": "Chantier termine",
            "description": "Pose du carrelage",
            "start_date": "2026-01-05T08:00:00Z",
            "end_date": "2026-01-05T10:00:00Z",
            "entries": [
                {"user": self.worker_a.id},
                {"user": self.worker_b.id, "hourly_rate": "30.00"},
            ],
        }
        payload.update(overrides)
        return payload

    # WHEN
    def when_create_day_entry(self, payload):
        return self.api_post(self.url, payload)

    # TESTS POST
    def test_anonymous_cannot_create_day_entry(self):
        response = self.when_create_day_entry(self.default_payload())

        self.assert_unauthorized(response)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 0)

    def test_owner_can_create_day_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_create_day_entry(self.default_payload())

        self.assert_created(response)
        data = self.response_data(response)
        self.assertEqual(data["task"]["status"], "done")
        self.assertIsNotNone(data["task"]["completed_at"])
        self.assertCountEqual(data["task"]["assigned_to"], [self.worker_a.id, self.worker_b.id])
        self.assertEqual(len(data["time_entries"]), 2)
        self.assertTrue(all(e["duration_minutes"] == 120 for e in data["time_entries"]))

        task = Task.objects.get(project=self.project, title="Chantier termine")
        self.assertEqual(task.status, "done")
        self.assertEqual(TimeEntry.objects.filter(task=task).count(), 2)
        worker_b_entry = TimeEntry.objects.get(task=task, user=self.worker_b)
        self.assertEqual(str(worker_b_entry.hourly_rate), "30.00")

    def test_owner_can_create_day_entry_with_folder_and_documents(self):
        self.given_authenticated(self.owner)

        response = self.when_create_day_entry(
            self.default_payload(folder=self.folder.id, documents=[self.document.id])
        )

        self.assert_created(response)
        task = Task.objects.get(project=self.project, title="Chantier termine")
        self.assertEqual(task.folder_id, self.folder.id)
        self.assertEqual(list(task.documents.values_list("id", flat=True)), [self.document.id])

    def test_member_with_both_permissions_can_create_day_entry(self):
        self.given_member_authenticated(["task.edit", "time_entry.edit"])

        response = self.when_create_day_entry(self.default_payload())

        self.assert_created(response)

    def test_member_without_time_entry_edit_cannot_create_day_entry(self):
        self.given_member_authenticated(["task.edit"])

        response = self.when_create_day_entry(self.default_payload())

        self.assert_forbidden(response)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 0)

    def test_member_without_task_edit_cannot_create_day_entry(self):
        self.given_member_authenticated(["time_entry.edit"])

        response = self.when_create_day_entry(self.default_payload())

        self.assert_forbidden(response)

    def test_non_member_cannot_create_day_entry(self):
        self.given_authenticated(self.other_user)

        response = self.when_create_day_entry(self.default_payload())

        self.assert_forbidden(response)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 0)

    def test_create_rejects_empty_entries(self):
        self.given_authenticated(self.owner)

        response = self.when_create_day_entry(self.default_payload(entries=[]))

        self.assert_bad_request(response)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 0)

    def test_create_rejects_user_not_project_member(self):
        self.given_authenticated(self.owner)
        outsider = User.objects.create_user(username="outsider", email="outsider@example.com")

        response = self.when_create_day_entry(
            self.default_payload(entries=[{"user": outsider.id}])
        )

        self.assert_bad_request(response)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 0)

    def test_create_rejects_end_date_before_start_date(self):
        self.given_authenticated(self.owner)

        response = self.when_create_day_entry(
            self.default_payload(start_date="2026-01-05T10:00:00Z", end_date="2026-01-05T08:00:00Z")
        )

        self.assert_bad_request(response)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 0)

    def test_create_rejects_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_day_entry(self.default_payload(folder=self.other_project_folder.id))

        self.assert_bad_request(response)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 0)


class TimeEntryRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.folder = Folder.objects.create(
            project=self.project,
            name="Time folder",
        )
        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other time folder",
        )
        self.task = Task.objects.create(
            project=self.project,
            folder=self.folder,
            created_by=self.owner,
            title="Time task",
        )
        self.worker = User.objects.create_user(
            username="time-worker",
            email="time-worker@example.com",
        )
        self.given_member_with_permissions([], user=self.worker)
        self.folder_entry = TimeEntry.objects.create(
            project=self.project,
            folder=self.folder,
            user=self.worker,
            duration_minutes=90,
            hourly_rate="45.00",
            description="Folder work",
            start_date=timezone.now(),
        )
        self.root_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=30,
            hourly_rate="0.00",
            description="Root work",
            start_date=timezone.now(),
        )
        self.deleted_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=15,
            hourly_rate="0.00",
            description="Deleted work",
            start_date=timezone.now(),
        )
        self.deleted_entry.soft_delete(self.owner)
        self.other_project_entry = TimeEntry.objects.create(
            project=self.other_project,
            user=self.other_user,
            duration_minutes=60,
            hourly_rate="50.00",
            description="Other project work",
            start_date=timezone.now(),
        )
        self.url = f"/api/projects/{self.project.id}/time-entries/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/time-entries/"

    # WHEN
    def when_list_time_entries(self, query=""):
        return self.api_get(f"{self.url}{query}")

    def when_create_time_entry(self, payload):
        return self.api_post(self.url, payload)

    # ASSERT
    def assert_visible_time_descriptions(self, response, expected_descriptions):
        entries = self.response_results(response)
        descriptions = {entry["description"] for entry in entries}
        self.assertEqual(descriptions, set(expected_descriptions))

    def assert_time_entry_exists(self, description):
        return TimeEntry.objects.get(project=self.project, description=description)

    def assert_time_entry_does_not_exist(self, description):
        self.assertFalse(TimeEntry.objects.filter(project=self.project, description=description).exists())

    # TESTS GET
    def test_anonymous_cannot_list_time_entries(self):
        response = self.when_list_time_entries()

        self.assert_unauthorized(response)

    def test_owner_can_list_active_project_time_entries_only(self):
        self.given_authenticated(self.owner)

        response = self.when_list_time_entries()

        self.assert_ok(response)
        # "Root work" a un cout nul (taux horaire 0) : elle est consideree deja
        # couverte et masquee par defaut, comme n'importe quelle entree payee.
        self.assert_visible_time_descriptions(response, ["Folder work"])

    def test_member_with_time_entry_view_can_list_own_time_entries_only(self):
        self.given_member_authenticated(["time_entry.view"])
        TimeEntry.objects.create(
            project=self.project,
            user=self.member,
            duration_minutes=45,
            hourly_rate="30.00",
            description="Own member work",
            start_date=timezone.now(),
        )

        response = self.when_list_time_entries()

        self.assert_ok(response)
        self.assert_visible_time_descriptions(response, ["Own member work"])

    def test_member_with_time_entry_view_all_only_still_lists_own_time_entries_only(self):
        # `time_entry.view_all` gouverne la synthese (stats/by_user), pas la liste
        # detaillee : sans `time_entry.view_others_detail`, la liste reste limitee
        # aux entrees du membre lui-meme, qui n'en a aucune ici.
        self.given_member_authenticated(["time_entry.view", "time_entry.view_all"])

        response = self.when_list_time_entries()

        self.assert_ok(response)
        self.assert_visible_time_descriptions(response, [])

    def test_member_with_time_entry_view_others_detail_can_list_time_entries(self):
        self.given_member_authenticated(["time_entry.view", "time_entry.view_others_detail"])

        response = self.when_list_time_entries()

        self.assert_ok(response)
        # "Root work" a un cout nul : masquee par defaut (voir plus haut).
        self.assert_visible_time_descriptions(response, ["Folder work"])

    def test_member_with_time_entry_pay_only_cannot_list_time_entries(self):
        self.given_member_authenticated(["time_entry.pay"])

        response = self.when_list_time_entries()

        self.assert_forbidden(response)

    def test_member_without_time_entry_view_cannot_list_time_entries(self):
        self.given_member_authenticated(["time_entry.edit"])

        response = self.when_list_time_entries()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_time_entries(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_time_entries()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_time_entries(self):
        self.given_member_authenticated(["time_entry.view"])
        self.url = self.other_project_url

        response = self.when_list_time_entries()

        self.assert_forbidden(response)

    def test_list_can_filter_by_folder(self):
        self.given_authenticated(self.owner)

        response = self.when_list_time_entries(f"?folder={self.folder.id}")

        self.assert_ok(response)
        self.assert_visible_time_descriptions(response, ["Folder work"])

    def test_list_can_filter_by_user_and_by_orphan_entries(self):
        self.given_authenticated(self.owner)
        TimeEntry.objects.create(
            project=self.project,
            user=None,
            duration_minutes=45,
            hourly_rate="30.00",
            description="Orphan work",
            start_date=timezone.now(),
        )

        by_member = self.when_list_time_entries(f"?user={self.worker.id}")
        orphans = self.when_list_time_entries("?user=none")

        self.assert_visible_time_descriptions(by_member, ["Folder work"])
        self.assert_visible_time_descriptions(orphans, ["Orphan work"])

    def test_list_can_filter_by_date_range(self):
        TimeEntry.objects.filter(pk=self.folder_entry.pk).update(
            start_date=timezone.make_aware(datetime(2025, 6, 12, 12, 0)),
        )
        TimeEntry.objects.filter(pk=self.root_entry.pk).update(
            start_date=timezone.make_aware(datetime(2025, 7, 1, 12, 0)),
        )
        self.given_authenticated(self.owner)

        response = self.when_list_time_entries("?start_date=2025-06-01&end_date=2025-06-30")

        self.assert_ok(response)
        self.assert_visible_time_descriptions(response, ["Folder work"])

    def test_list_hides_fully_paid_entries_by_default(self):
        paid_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=60,
            hourly_rate="20.00",
            description="Fully paid work",
            start_date=timezone.now(),
        )
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=paid_entry,
            created_by=self.owner,
            amount="20.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Full payment",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_time_entries()

        self.assert_ok(response)
        # "Fully paid work" est masquee (payee) et "Root work" aussi (cout nul).
        self.assert_visible_time_descriptions(response, ["Folder work"])

    def test_list_can_include_paid_entries(self):
        paid_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=60,
            hourly_rate="20.00",
            description="Fully paid work",
            start_date=timezone.now(),
        )
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=paid_entry,
            created_by=self.owner,
            amount="20.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Full payment",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_time_entries("?include_paid=true")

        self.assert_ok(response)
        self.assert_visible_time_descriptions(
            response, ["Folder work", "Root work", "Fully paid work"],
        )

    def test_list_can_search_by_description(self):
        self.given_authenticated(self.owner)

        # "Root work" a un cout nul et serait masquee par le filtre par defaut ;
        # include_paid=true isole ce test sur le comportement de la recherche.
        response = self.when_list_time_entries("?search=Root&include_paid=true")

        self.assert_ok(response)
        self.assert_visible_time_descriptions(response, ["Root work"])

    def test_list_includes_payment_status_fields(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.folder_entry,
            created_by=self.owner,
            amount="45.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Partial payment",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_time_entries(f"?folder={self.folder.id}")

        self.assert_ok(response)
        entry = self.response_results(response)[0]
        self.assertEqual(entry["cost_amount"], "67.50")
        self.assertEqual(entry["paid_amount"], "45.00")
        self.assertEqual(entry["remaining_amount"], "22.50")

    def test_list_marks_time_entry_as_paid_when_expenses_cover_cost(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.folder_entry,
            created_by=self.owner,
            amount="67.50",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Full payment",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_time_entries(f"?folder={self.folder.id}&include_paid=true")

        self.assert_ok(response)
        entry = self.response_results(response)[0]
        self.assertEqual(entry["cost_amount"], "67.50")
        self.assertEqual(entry["paid_amount"], "67.50")
        self.assertEqual(entry["remaining_amount"], "0.00")

    def test_list_subtracts_time_entry_refunds_from_paid_amount(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.folder_entry,
            created_by=self.owner,
            amount="67.50",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Full payment before refund",
        )
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.folder_entry,
            created_by=self.owner,
            amount="20.00",
            type=FinancialEntry.FinancialType.REFUND,
            description="Labor refund",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_time_entries(f"?folder={self.folder.id}")

        self.assert_ok(response)
        entry = self.response_results(response)[0]
        self.assertEqual(entry["cost_amount"], "67.50")
        self.assertEqual(entry["paid_amount"], "47.50")
        self.assertEqual(entry["remaining_amount"], "20.00")

    # TESTS POST
    def test_anonymous_cannot_create_time_entry(self):
        response = self.when_create_time_entry({
            "user": self.owner.id,
            "duration_minutes": 60,
            "description": "Anonymous time",
        })

        self.assert_unauthorized(response)
        self.assert_time_entry_does_not_exist("Anonymous time")

    def test_owner_can_create_root_time_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_create_time_entry({
            "user": self.owner.id,
            "duration_minutes": 60,
            "description": "Created root time",
            "start_date": "2025-06-01T10:00:00Z",
        })

        self.assert_created(response)
        entry = self.assert_time_entry_exists("Created root time")
        self.assertIsNone(entry.folder_id)
        self.assertIsNone(entry.task_id)

    def test_member_with_time_entry_edit_can_create_time_entry(self):
        self.given_member_authenticated(["time_entry.edit"])

        response = self.when_create_time_entry({
            "folder": self.folder.id,
            "user": self.member.id,
            "duration_minutes": 45,
            "hourly_rate": "35.00",
            "description": "Member time",
            "start_date": "2025-06-01T10:00:00Z",
        })

        self.assert_created(response)
        entry = self.assert_time_entry_exists("Member time")
        self.assertEqual(entry.user_id, self.member.id)

    def test_member_without_time_entry_edit_cannot_create_time_entry(self):
        self.given_member_authenticated(["time_entry.view"])

        response = self.when_create_time_entry({
            "user": self.member.id,
            "duration_minutes": 45,
            "description": "Blocked time",
        })

        self.assert_forbidden(response)
        self.assert_time_entry_does_not_exist("Blocked time")

    def test_create_rejects_folder_and_task_together(self):
        self.given_authenticated(self.owner)

        response = self.when_create_time_entry({
            "folder": self.folder.id,
            "task": self.task.id,
            "user": self.owner.id,
            "duration_minutes": 60,
            "description": "Invalid target time",
            "start_date": "2025-06-01T10:00:00Z",
        })

        self.assert_bad_request(response)
        self.assert_time_entry_does_not_exist("Invalid target time")

    def test_create_rejects_user_outside_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_time_entry({
            "user": self.other_user.id,
            "duration_minutes": 60,
            "description": "Invalid user time",
            "start_date": "2025-06-01T10:00:00Z",
        })

        self.assert_bad_request(response)
        self.assert_time_entry_does_not_exist("Invalid user time")

    def test_create_rejects_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_time_entry({
            "folder": self.other_project_folder.id,
            "user": self.owner.id,
            "duration_minutes": 60,
            "description": "Invalid folder time",
            "start_date": "2025-06-01T10:00:00Z",
        })

        self.assert_bad_request(response)
        self.assert_time_entry_does_not_exist("Invalid folder time")


class TimeEntryDetailRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=60,
            hourly_rate="40.00",
            description="Target time",
            start_date=timezone.now(),
        )
        self.other_project_entry = TimeEntry.objects.create(
            project=self.other_project,
            user=self.other_user,
            duration_minutes=60,
            hourly_rate="40.00",
            description="Other time",
            start_date=timezone.now(),
        )
        self.url = f"/api/projects/{self.project.id}/time-entries/{self.entry.id}/"

    # WHEN
    def when_get_time_entry(self):
        return self.api_get(self.url)

    def when_patch_time_entry(self, payload):
        return self.api_patch(self.url, payload)

    def when_delete_time_entry(self):
        return self.api_delete(self.url)

    # ASSERT
    def assert_time_description(self, expected_description):
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.description, expected_description)

    def assert_time_entry_not_deleted(self):
        self.entry.refresh_from_db()
        self.assertIsNone(self.entry.deleted_at)

    def assert_time_entry_deleted_by(self, user):
        self.entry.refresh_from_db()
        self.assertIsNotNone(self.entry.deleted_at)
        self.assertEqual(self.entry.deleted_by_id, user.id)

    # TESTS GET
    def test_anonymous_cannot_get_time_entry(self):
        response = self.when_get_time_entry()

        self.assert_unauthorized(response)

    def test_owner_can_get_time_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_get_time_entry()

        self.assert_ok(response)

    def test_member_with_time_entry_view_cannot_get_other_member_time_entry(self):
        self.given_member_authenticated(["time_entry.view"])

        response = self.when_get_time_entry()

        self.assert_not_found(response)

    def test_member_with_time_entry_view_all_only_cannot_get_other_member_time_entry(self):
        # Meme remarque que pour la liste : `time_entry.view_all` seul ne donne pas
        # acces au detail d'une entree d'un autre membre.
        self.given_member_authenticated(["time_entry.view", "time_entry.view_all"])

        response = self.when_get_time_entry()

        self.assert_not_found(response)

    def test_member_with_time_entry_view_others_detail_can_get_time_entry(self):
        self.given_member_authenticated(["time_entry.view", "time_entry.view_others_detail"])

        response = self.when_get_time_entry()

        self.assert_ok(response)

    def test_member_without_time_entry_view_cannot_get_time_entry(self):
        self.given_member_authenticated([])

        response = self.when_get_time_entry()

        self.assert_forbidden(response)

    def test_non_member_cannot_get_time_entry(self):
        self.given_authenticated(self.other_user)

        response = self.when_get_time_entry()

        self.assert_forbidden(response)

    def test_member_cannot_get_time_entry_from_another_project(self):
        self.given_member_authenticated(["time_entry.view"])
        self.url = f"/api/projects/{self.other_project.id}/time-entries/{self.other_project_entry.id}/"

        response = self.when_get_time_entry()

        self.assert_forbidden(response)

    # TESTS PATCH
    def test_owner_can_patch_time_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_time_entry({"description": "Owner edited time"})

        self.assert_ok(response)
        self.assert_time_description("Owner edited time")

    def test_member_with_time_entry_edit_can_patch_time_entry(self):
        self.given_member_authenticated(["time_entry.edit"])

        response = self.when_patch_time_entry({"description": "Member edited time"})

        self.assert_ok(response)
        self.assert_time_description("Member edited time")

    def test_member_without_time_entry_edit_cannot_patch_time_entry(self):
        self.given_member_authenticated(["time_entry.view"])

        response = self.when_patch_time_entry({"description": "Blocked edit"})

        self.assert_forbidden(response)
        self.assert_time_description("Target time")

    # TESTS PATCH — attribution d'une entree orpheline
    def test_owner_can_assign_an_orphan_time_entry_to_a_member(self):
        self.given_member_with_permissions([])
        self.given_authenticated(self.owner)
        orphan = TimeEntry.objects.create(
            project=self.project,
            user=None,
            duration_minutes=60,
            hourly_rate="40.00",
            description="Orphan time",
            start_date=timezone.now(),
        )

        response = self.api_patch(
            f"/api/projects/{self.project.id}/time-entries/{orphan.id}/",
            {"user": self.member.id},
        )

        self.assert_ok(response)
        orphan.refresh_from_db()
        self.assertEqual(orphan.user_id, self.member.id)

    def test_assigning_an_already_assigned_time_entry_to_another_user_is_rejected(self):
        # Les heures d'une entree attribuee peuvent deja avoir ete payees a son titulaire :
        # seules les entrees orphelines sont attribuables.
        self.given_member_with_permissions([])
        self.given_authenticated(self.owner)

        response = self.when_patch_time_entry({"user": self.member.id})

        self.assert_bad_request(response)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.user_id, self.owner.id)

    def test_assigning_an_orphan_time_entry_to_a_non_member_is_rejected(self):
        self.given_authenticated(self.owner)
        orphan = TimeEntry.objects.create(
            project=self.project,
            user=None,
            duration_minutes=60,
            hourly_rate="40.00",
            description="Orphan time",
            start_date=timezone.now(),
        )

        response = self.api_patch(
            f"/api/projects/{self.project.id}/time-entries/{orphan.id}/",
            {"user": self.other_user.id},
        )

        self.assert_bad_request(response)
        orphan.refresh_from_db()
        self.assertIsNone(orphan.user_id)

    # TESTS DELETE
    def test_owner_can_soft_delete_time_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_delete_time_entry()

        self.assert_no_content(response)
        self.assert_time_entry_deleted_by(self.owner)

    def test_member_with_time_entry_delete_can_soft_delete_time_entry(self):
        self.given_member_authenticated(["time_entry.delete"])

        response = self.when_delete_time_entry()

        self.assert_no_content(response)
        self.assert_time_entry_deleted_by(self.member)

    def test_member_without_time_entry_delete_cannot_delete_time_entry(self):
        self.given_member_authenticated(["time_entry.edit"])

        response = self.when_delete_time_entry()

        self.assert_forbidden(response)
        self.assert_time_entry_not_deleted()


class TimeEntryStatsRoutePermissionTests(ProjectApiTestCase):
    """Couvre les deux axes independants de `own_unless_has_permission` sur le meme
    projet : `time_entry.view_all` (repartition par membre, `by_user`) et
    `time_entry.view_others_detail` (liste detaillee), pour verifier qu'ils ne se
    debloquent pas l'un l'autre."""

    def setUp(self):
        super().setUp()

        self.worker = User.objects.create_user(
            username="stats-worker",
            email="stats-worker@example.com",
        )
        self.given_member_with_permissions([], user=self.worker)
        self.worker_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.worker,
            duration_minutes=90,
            hourly_rate="45.00",
            description="Worker stats work",
            start_date=timezone.now(),
        )
        self.owner_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=30,
            hourly_rate="20.00",
            description="Owner stats work",
            start_date=timezone.now(),
        )
        self.stats_url = f"/api/projects/{self.project.id}/time-entries/stats/"
        self.list_url = f"/api/projects/{self.project.id}/time-entries/"

    # WHEN
    def when_get_stats(self):
        return self.api_get(self.stats_url)

    # ASSERT
    def assert_by_user_ids(self, response, expected_user_ids):
        by_user = self.response_data(response)["by_user"]
        self.assertEqual({row["user"] for row in by_user}, set(expected_user_ids))

    # TESTS
    def test_member_without_time_entry_view_all_sees_only_own_breakdown(self):
        self.given_member_authenticated(["time_entry.view"])
        TimeEntry.objects.create(
            project=self.project,
            user=self.member,
            duration_minutes=45,
            hourly_rate="30.00",
            description="Member stats work",
            start_date=timezone.now(),
        )

        response = self.when_get_stats()

        self.assert_ok(response)
        self.assert_by_user_ids(response, [self.member.id])

    def test_member_with_time_entry_view_all_sees_breakdown_for_all_members(self):
        self.given_member_authenticated(["time_entry.view", "time_entry.view_all"])

        response = self.when_get_stats()

        self.assert_ok(response)
        self.assert_by_user_ids(response, [self.worker.id, self.owner.id])

    def test_orphan_entries_are_reported_as_an_unattributed_breakdown_row(self):
        # Sans ligne `user: null`, la somme de `by_user` ne retombe pas sur le total global
        # et le "reste a payer" affiche depasse ce qui est attribuable a quelqu'un.
        self.given_authenticated(self.owner)
        TimeEntry.objects.create(
            project=self.project,
            user=None,
            duration_minutes=60,
            hourly_rate="50.00",
            description="Orphan work",
            start_date=timezone.now(),
        )

        response = self.when_get_stats()

        self.assert_ok(response)
        self.assert_by_user_ids(response, [self.worker.id, self.owner.id, None])
        by_user = self.response_data(response)["by_user"]
        orphan_row = next(row for row in by_user if row["user"] is None)
        self.assertEqual(orphan_row["cost_amount"], "50.00")

    def test_member_with_time_entry_view_all_only_still_has_own_detail_list_only(self):
        # `view_all` donne acces a la synthese complete mais pas a la liste
        # detaillee des autres membres : les deux permissions sont independantes.
        self.given_member_authenticated(["time_entry.view", "time_entry.view_all"])

        stats_response = self.when_get_stats()
        list_response = self.api_get(self.list_url)

        self.assert_ok(stats_response)
        self.assert_by_user_ids(stats_response, [self.worker.id, self.owner.id])
        self.assertEqual(self.response_results(list_response), [])


class TimeEntryPaymentRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=60,
            hourly_rate="40.00",
            description="Payable time",
            start_date=timezone.now(),
        )
        self.url = f"/api/projects/{self.project.id}/time-entries/{self.entry.id}/pay/"

    def when_pay_time_entry(self, payload):
        return self.api_post(self.url, payload)

    def assert_time_payment_exists(self, amount):
        self.assertTrue(
            FinancialEntry.objects.filter(
                project=self.project,
                time_entry=self.entry,
                amount=amount,
                type=FinancialEntry.FinancialType.EXPENSE,
            ).exists()
        )

    def test_owner_can_pay_full_time_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_pay_time_entry({"pay_full": True})

        self.assert_created(response)
        self.assert_time_payment_exists(Decimal("40.00"))

    def test_member_with_time_entry_pay_can_pay_partial_amount(self):
        self.given_member_authenticated(["time_entry.pay"])

        response = self.when_pay_time_entry({"amount": "15.50"})

        self.assert_created(response)
        self.assert_time_payment_exists(Decimal("15.50"))

    def test_member_without_time_entry_pay_cannot_pay_time_entry(self):
        self.given_member_authenticated(["time_entry.view_all"])

        response = self.when_pay_time_entry({"pay_full": True})

        self.assert_forbidden(response)

    def test_payment_rejects_amount_above_remaining_amount(self):
        self.given_authenticated(self.owner)

        response = self.when_pay_time_entry({"amount": "40.01"})

        self.assert_bad_request(response)


class TimeEntryBulkPaymentRoutePermissionTests(ProjectApiTestCase):
    """Paiement groupe : un montant global reparti de l'entree la plus ancienne a la plus
    recente, la derniere servie pouvant ne l'etre que partiellement. Le scope paye suit les
    memes filtres (query string) que le endpoint de stats, `user` etant obligatoire."""

    def setUp(self):
        super().setUp()

        now = timezone.now()
        self.oldest = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=60,
            hourly_rate="40.00",
            description="Oldest payable time",
            start_date=now - timedelta(days=2),
        )
        self.middle = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=30,
            hourly_rate="40.00",
            description="Middle payable time",
            start_date=now - timedelta(days=1),
        )
        self.newest = TimeEntry.objects.create(
            project=self.project,
            user=self.member,
            duration_minutes=60,
            hourly_rate="40.00",
            description="Newest payable time",
            start_date=now,
        )
        self.url = f"/api/projects/{self.project.id}/time-entries/bulk-pay/"

    # WHEN
    def when_bulk_pay(self, payload, user=None):
        query = "" if user is None else f"?user={user.id}"
        return self.api_post(f"{self.url}{query}", payload)

    # ASSERT
    def assert_paid_amount(self, time_entry, expected_amount):
        self.assertEqual(time_entry.get_paid_amount(), Decimal(expected_amount))

    # TESTS
    def test_owner_bulk_payment_settles_entries_from_oldest_to_newest(self):
        self.given_authenticated(self.owner)

        response = self.when_bulk_pay({"amount": "50.00"}, user=self.owner)

        self.assert_created(response)
        self.assertEqual(self.response_data(response)["paid_entry_count"], 1)
        self.assertEqual(self.response_data(response)["partial_entry_count"], 1)
        self.assert_paid_amount(self.oldest, "40.00")
        self.assert_paid_amount(self.middle, "10.00")
        self.assert_paid_amount(self.newest, "0.00")

    def test_member_with_time_entry_pay_can_bulk_pay_other_members_entries(self):
        self.given_member_authenticated(["time_entry.view", "time_entry.view_all", "time_entry.pay"])

        response = self.when_bulk_pay({"amount": "40.00"}, user=self.owner)

        self.assert_created(response)
        self.assert_paid_amount(self.oldest, "40.00")

    def test_member_without_time_entry_pay_cannot_bulk_pay(self):
        self.given_member_authenticated(["time_entry.view", "time_entry.view_all"])

        response = self.when_bulk_pay({"amount": "40.00"}, user=self.owner)

        self.assert_forbidden(response)

    def test_bulk_payment_requires_a_selected_user(self):
        self.given_authenticated(self.owner)

        response = self.when_bulk_pay({"amount": "40.00"})

        self.assert_bad_request(response)
        self.assertIn("user", self.response_data(response))
        self.assert_paid_amount(self.oldest, "0.00")

    def test_bulk_payment_rejects_the_orphan_scope(self):
        # `user=none` filtre les entrees sans titulaire : un scope valide pour la liste,
        # mais sans beneficiaire a payer.
        self.given_authenticated(self.owner)

        response = self.api_post(f"{self.url}?user=none", {"amount": "10.00"})

        self.assert_bad_request(response)
        self.assertIn("user", self.response_data(response))

    def test_bulk_payment_rejects_amount_above_the_selected_user_remaining_total(self):
        self.given_authenticated(self.owner)

        # 40.00 (oldest) + 20.00 (middle) pour l'owner : l'entree du membre n'entre pas
        # dans le scope et n'augmente donc pas le montant payable.
        response = self.when_bulk_pay({"amount": "60.01"}, user=self.owner)

        self.assert_bad_request(response)
        self.assert_paid_amount(self.oldest, "0.00")

    def test_bulk_payment_only_covers_entries_of_the_selected_user(self):
        self.given_authenticated(self.owner)

        response = self.when_bulk_pay({"amount": "40.00"}, user=self.member)

        self.assert_created(response)
        self.assert_paid_amount(self.newest, "40.00")
        self.assert_paid_amount(self.oldest, "0.00")


class TimeEntryFinancialFormulaConsistencyTests(ProjectApiTestCase):
    """`TimeEntry.get_cost_amount`/`get_paid_amount` (Python, per-instance) and
    `TimeEntryQuerySet.with_financial_totals` (SQL, for filtering/aggregating across
    rows) independently implement the same cost/paid formula — see the docstring on
    `with_financial_totals` for why they can't be unified. This locks them in sync:
    if a future change to one formula isn't mirrored in the other, this test catches
    the drift instead of it surfacing as a silent inconsistency between the
    `payment_status` filter and the displayed `remaining_amount`.
    """

    def setUp(self):
        super().setUp()
        self.entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=120,
            hourly_rate="50.00",
            description="Formula consistency entry",
            start_date=timezone.now(),
        )

    def assert_formulas_match(self):
        self.entry.refresh_from_db()
        annotated = TimeEntry.objects.filter(pk=self.entry.pk).with_financial_totals().values(
            "filter_cost_amount", "filter_paid_amount",
        ).get()

        self.assertEqual(annotated["filter_cost_amount"], self.entry.get_cost_amount())
        self.assertEqual(max(annotated["filter_paid_amount"], Decimal("0.00")), self.entry.get_paid_amount())
        self.assertEqual(
            max(annotated["filter_cost_amount"] - annotated["filter_paid_amount"], Decimal("0.00")),
            self.entry.get_remaining_amount(),
        )

    def test_formulas_match_with_no_payment(self):
        self.assert_formulas_match()

    def test_formulas_match_with_partial_payment(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.entry,
            created_by=self.owner,
            amount=Decimal("40.00"),
            type=FinancialEntry.FinancialType.EXPENSE,
        )

        self.assert_formulas_match()

    def test_formulas_match_with_payment_and_refund(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.entry,
            created_by=self.owner,
            amount=Decimal("40.00"),
            type=FinancialEntry.FinancialType.EXPENSE,
        )
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.entry,
            created_by=self.owner,
            amount=Decimal("15.00"),
            type=FinancialEntry.FinancialType.REFUND,
        )

        self.assert_formulas_match()

    def test_formulas_exclude_soft_deleted_financial_entry(self):
        # Regression : `filter_paid_amount` traversait `financial_entries__amount` via
        # un JOIN brut qui ignore le manager soft-delete de FinancialEntry — une depense
        # supprimee comptait quand meme comme payee cote SQL, alors que le calcul Python
        # (get_paid_amount, via le manager actif) l'excluait deja correctement.
        payment = FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.entry,
            created_by=self.owner,
            amount=Decimal("40.00"),
            type=FinancialEntry.FinancialType.EXPENSE,
        )
        payment.soft_delete(self.owner)

        self.assert_formulas_match()
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.get_paid_amount(), Decimal("0.00"))
        annotated = TimeEntry.objects.filter(pk=self.entry.pk).with_financial_totals().values(
            "filter_paid_amount",
        ).get()
        self.assertEqual(annotated["filter_paid_amount"], Decimal("0.00"))

    def test_formulas_match_when_fully_paid(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.entry,
            created_by=self.owner,
            amount=Decimal("100.00"),
            type=FinancialEntry.FinancialType.EXPENSE,
        )

        self.assert_formulas_match()


class TimeEntryTrashRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.deleted_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=30,
            hourly_rate="0.00",
            description="Deleted time",
            start_date=timezone.now(),
        )
        self.deleted_entry.soft_delete(self.owner)
        self.other_project_deleted_entry = TimeEntry.objects.create(
            project=self.other_project,
            user=self.other_user,
            duration_minutes=30,
            hourly_rate="0.00",
            description="Other deleted time",
            start_date=timezone.now(),
        )
        self.other_project_deleted_entry.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/time-entries/trash/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/time-entries/trash/"

    def when_list_deleted_time_entries(self):
        return self.api_get(self.url)

    def assert_visible_time_descriptions(self, response, expected_descriptions):
        entries = self.response_results(response)
        descriptions = {entry["description"] for entry in entries}
        self.assertEqual(descriptions, set(expected_descriptions))

    def test_owner_can_list_deleted_time_entries(self):
        self.given_authenticated(self.owner)

        response = self.when_list_deleted_time_entries()

        self.assert_ok(response)
        self.assert_visible_time_descriptions(response, ["Deleted time"])

    def test_anonymous_cannot_list_deleted_time_entries(self):
        response = self.when_list_deleted_time_entries()

        self.assert_unauthorized(response)

    def test_member_with_time_entry_restore_can_list_deleted_time_entries(self):
        self.given_member_authenticated(["time_entry.restore"])

        response = self.when_list_deleted_time_entries()

        self.assert_ok(response)
        self.assert_visible_time_descriptions(response, ["Deleted time"])

    def test_member_without_time_entry_restore_cannot_list_deleted_time_entries(self):
        self.given_member_authenticated(["time_entry.view"])

        response = self.when_list_deleted_time_entries()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_deleted_time_entries(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_deleted_time_entries()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_deleted_time_entries(self):
        self.given_member_authenticated(["time_entry.view"])
        self.url = self.other_project_url

        response = self.when_list_deleted_time_entries()

        self.assert_forbidden(response)


class TimeEntryRestoreRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.deleted_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=30,
            hourly_rate="0.00",
            description="Deleted time",
            start_date=timezone.now(),
        )
        self.deleted_entry.soft_delete(self.owner)
        self.other_project_deleted_entry = TimeEntry.objects.create(
            project=self.other_project,
            user=self.other_user,
            duration_minutes=30,
            hourly_rate="0.00",
            description="Other deleted time",
            start_date=timezone.now(),
        )
        self.other_project_deleted_entry.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/time-entries/{self.deleted_entry.id}/restore/"

    def when_restore_time_entry(self):
        return self.api_post(self.url, {})

    def assert_time_entry_still_deleted(self):
        self.deleted_entry.refresh_from_db()
        self.assertIsNotNone(self.deleted_entry.deleted_at)

    def assert_time_entry_restored(self):
        self.deleted_entry.refresh_from_db()
        self.assertIsNone(self.deleted_entry.deleted_at)
        self.assertIsNone(self.deleted_entry.deleted_by_id)

    def test_owner_can_restore_time_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_restore_time_entry()

        self.assert_ok(response)
        self.assert_time_entry_restored()

    def test_anonymous_cannot_restore_time_entry(self):
        response = self.when_restore_time_entry()

        self.assert_unauthorized(response)
        self.assert_time_entry_still_deleted()

    def test_member_with_time_entry_restore_can_restore_time_entry(self):
        self.given_member_authenticated(["time_entry.restore"])

        response = self.when_restore_time_entry()

        self.assert_ok(response)
        self.assert_time_entry_restored()

    def test_member_without_time_entry_restore_cannot_restore_time_entry(self):
        self.given_member_authenticated(["time_entry.view"])

        response = self.when_restore_time_entry()

        self.assert_forbidden(response)
        self.assert_time_entry_still_deleted()

    def test_non_member_cannot_restore_time_entry(self):
        self.given_authenticated(self.other_user)

        response = self.when_restore_time_entry()

        self.assert_forbidden(response)
        self.assert_time_entry_still_deleted()

    def test_member_cannot_restore_time_entry_from_another_project(self):
        self.given_member_authenticated(["time_entry.restore"])
        self.url = (
            f"/api/projects/{self.other_project.id}/time-entries/"
            f"{self.other_project_deleted_entry.id}/restore/"
        )

        response = self.when_restore_time_entry()

        self.assert_forbidden(response)
        self.other_project_deleted_entry.refresh_from_db()
        self.assertIsNotNone(self.other_project_deleted_entry.deleted_at)


class FinancialEntryRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.folder = Folder.objects.create(
            project=self.project,
            name="Finance folder",
        )
        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other finance folder",
        )
        self.document = Document.objects.create(
            project=self.project,
            folder=self.folder,
            name="Receipt",
            file_id="receipt-file",
            file_name="receipt.pdf",
        )
        self.time_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=60,
            hourly_rate="50.00",
            description="Finance time",
            start_date=timezone.now(),
        )
        self.other_project_time_entry = TimeEntry.objects.create(
            project=self.other_project,
            user=self.other_user,
            duration_minutes=60,
            hourly_rate="50.00",
            description="Other finance time",
            start_date=timezone.now(),
        )
        self.expense = FinancialEntry.objects.create(
            project=self.project,
            folder=self.folder,
            created_by=self.owner,
            amount="120.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Paint purchase",
        )
        self.expense.documents.set([self.document])
        self.refund = FinancialEntry.objects.create(
            project=self.project,
            created_by=self.owner,
            amount="30.00",
            type=FinancialEntry.FinancialType.REFUND,
            description="Paint refund",
        )
        self.deleted_entry = FinancialEntry.objects.create(
            project=self.project,
            created_by=self.owner,
            amount="10.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Deleted finance",
        )
        self.deleted_entry.soft_delete(self.owner)
        self.other_project_entry = FinancialEntry.objects.create(
            project=self.other_project,
            created_by=self.other_user,
            amount="80.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Other project finance",
        )
        self.url = f"/api/projects/{self.project.id}/financial-entries/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/financial-entries/"

    # WHEN
    def when_list_financial_entries(self, query=""):
        return self.api_get(f"{self.url}{query}")

    def when_create_financial_entry(self, payload):
        return self.api_post(self.url, payload)

    # ASSERT
    def assert_visible_financial_descriptions(self, response, expected_descriptions):
        entries = self.response_results(response)
        descriptions = {entry["description"] for entry in entries}
        self.assertEqual(descriptions, set(expected_descriptions))

    def assert_financial_entry_exists(self, description):
        return FinancialEntry.objects.get(project=self.project, description=description)

    def assert_financial_entry_does_not_exist(self, description):
        self.assertFalse(FinancialEntry.objects.filter(project=self.project, description=description).exists())

    # TESTS GET
    def test_anonymous_cannot_list_financial_entries(self):
        response = self.when_list_financial_entries()

        self.assert_unauthorized(response)

    def test_owner_can_list_active_project_financial_entries_only(self):
        self.given_authenticated(self.owner)

        response = self.when_list_financial_entries()

        self.assert_ok(response)
        self.assert_visible_financial_descriptions(response, ["Paint purchase", "Paint refund"])

    def test_member_with_finance_view_can_list_financial_entries(self):
        self.given_member_authenticated(["finance.view"])

        response = self.when_list_financial_entries()

        self.assert_ok(response)
        self.assert_visible_financial_descriptions(response, ["Paint purchase", "Paint refund"])

    def test_member_without_finance_view_cannot_list_financial_entries(self):
        self.given_member_authenticated(["finance.edit"])

        response = self.when_list_financial_entries()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_financial_entries(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_financial_entries()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_financial_entries(self):
        self.given_member_authenticated(["finance.view"])
        self.url = self.other_project_url

        response = self.when_list_financial_entries()

        self.assert_forbidden(response)

    def test_list_can_filter_by_type(self):
        self.given_authenticated(self.owner)

        response = self.when_list_financial_entries("?type=refund")

        self.assert_ok(response)
        self.assert_visible_financial_descriptions(response, ["Paint refund"])

    def test_list_can_filter_by_source(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.time_entry,
            created_by=self.owner,
            amount="50.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Labor payment",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_financial_entries("?source=labor")

        self.assert_ok(response)
        self.assert_visible_financial_descriptions(response, ["Labor payment"])

    def test_list_can_search_by_description(self):
        self.given_authenticated(self.owner)

        response = self.when_list_financial_entries("?search=refund")

        self.assert_ok(response)
        self.assert_visible_financial_descriptions(response, ["Paint refund"])

    # TESTS POST
    def test_anonymous_cannot_create_financial_entry(self):
        response = self.when_create_financial_entry({
            "amount": "15.00",
            "type": "expense",
            "description": "Anonymous finance",
        })

        self.assert_unauthorized(response)
        self.assert_financial_entry_does_not_exist("Anonymous finance")

    def test_owner_can_create_financial_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_create_financial_entry({
            "folder": self.folder.id,
            "documents": [self.document.id],
            "amount": "15.00",
            "type": "expense",
            "description": "Created finance",
        })

        self.assert_created(response)
        entry = self.assert_financial_entry_exists("Created finance")
        self.assertEqual(entry.created_by_id, self.owner.id)
        self.assertEqual(list(entry.documents.values_list("id", flat=True)), [self.document.id])

    def test_owner_can_create_financial_entry_linked_to_time_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_create_financial_entry({
            "amount": "25.00",
            "type": "expense",
            "description": "Partial time payment",
            "time_entry": self.time_entry.id,
        })

        self.assert_created(response)
        entry = self.assert_financial_entry_exists("Partial time payment")
        self.assertEqual(entry.time_entry_id, self.time_entry.id)

        time_response = self.api_get(
            f"/api/projects/{self.project.id}/time-entries/{self.time_entry.id}/"
        )
        self.assert_ok(time_response)
        time_entry_data = self.response_data(time_response)
        self.assertEqual(time_entry_data["cost_amount"], "50.00")
        self.assertEqual(time_entry_data["paid_amount"], "25.00")
        self.assertEqual(time_entry_data["remaining_amount"], "25.00")

    def test_create_rejects_time_entry_overpayment(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.time_entry,
            created_by=self.owner,
            amount="25.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Existing time payment",
        )
        self.given_authenticated(self.owner)

        response = self.when_create_financial_entry({
            "amount": "30.00",
            "type": "expense",
            "description": "Too much time payment",
            "time_entry": self.time_entry.id,
        })

        self.assert_bad_request(response)
        self.assert_financial_entry_does_not_exist("Too much time payment")

    def test_create_allows_time_entry_exact_remaining_amount(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.time_entry,
            created_by=self.owner,
            amount="25.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Existing partial time payment",
        )
        self.given_authenticated(self.owner)

        response = self.when_create_financial_entry({
            "amount": "25.00",
            "type": "expense",
            "description": "Exact remaining time payment",
            "time_entry": self.time_entry.id,
        })

        self.assert_created(response)
        entry = self.assert_financial_entry_exists("Exact remaining time payment")
        self.assertEqual(entry.time_entry_id, self.time_entry.id)

    def test_create_rejects_refund_exceeding_time_entry_paid_amount(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.time_entry,
            created_by=self.owner,
            amount="25.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Existing time payment",
        )
        self.given_authenticated(self.owner)

        response = self.when_create_financial_entry({
            "amount": "25.01",
            "type": "refund",
            "description": "Refund larger than paid amount",
            "time_entry": self.time_entry.id,
        })

        self.assert_bad_request(response)
        self.assert_financial_entry_does_not_exist("Refund larger than paid amount")

    def test_create_allows_refund_exactly_matching_time_entry_paid_amount(self):
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.time_entry,
            created_by=self.owner,
            amount="25.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Existing time payment",
        )
        self.given_authenticated(self.owner)

        response = self.when_create_financial_entry({
            "amount": "25.00",
            "type": "refund",
            "description": "Full refund of time payment",
            "time_entry": self.time_entry.id,
        })

        self.assert_created(response)
        self.assert_financial_entry_exists("Full refund of time payment")

    def test_member_with_finance_edit_can_create_financial_entry(self):
        self.given_member_authenticated(["finance.edit"])

        response = self.when_create_financial_entry({
            "amount": "15.00",
            "type": "refund",
            "description": "Member finance",
        })

        self.assert_created(response)
        entry = self.assert_financial_entry_exists("Member finance")
        self.assertEqual(entry.created_by_id, self.member.id)

    def test_member_without_finance_edit_cannot_create_financial_entry(self):
        self.given_member_authenticated(["finance.view"])

        response = self.when_create_financial_entry({
            "amount": "15.00",
            "type": "expense",
            "description": "Blocked finance",
        })

        self.assert_forbidden(response)
        self.assert_financial_entry_does_not_exist("Blocked finance")

    def test_create_rejects_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_financial_entry({
            "folder": self.other_project_folder.id,
            "amount": "15.00",
            "type": "expense",
            "description": "Invalid folder finance",
        })

        self.assert_bad_request(response)
        self.assert_financial_entry_does_not_exist("Invalid folder finance")

    def test_create_rejects_time_entry_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_financial_entry({
            "time_entry": self.other_project_time_entry.id,
            "amount": "25.00",
            "type": "expense",
            "description": "Invalid time finance",
        })

        self.assert_bad_request(response)
        self.assert_financial_entry_does_not_exist("Invalid time finance")

    def test_create_rejects_removed_payment_type(self):
        self.given_authenticated(self.owner)

        response = self.when_create_financial_entry({
            "amount": "15.00",
            "type": "payment",
            "description": "Invalid payment finance",
        })

        self.assert_bad_request(response)
        self.assert_financial_entry_does_not_exist("Invalid payment finance")


class FinancialEntryChartRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.chart_time_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=60,
            hourly_rate="50.00",
            description="Chart time",
            start_date=timezone.now(),
        )
        self.january_expense = FinancialEntry.objects.create(
            project=self.project,
            created_by=self.owner,
            amount="100.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="January labor",
        )
        self.january_refund = FinancialEntry.objects.create(
            project=self.project,
            created_by=self.owner,
            amount="25.00",
            type=FinancialEntry.FinancialType.REFUND,
            description="January refund",
        )
        self.february_expense = FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.chart_time_entry,
            created_by=self.owner,
            amount="50.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="February material",
        )
        self.deleted_entry = FinancialEntry.objects.create(
            project=self.project,
            created_by=self.owner,
            amount="900.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Deleted chart entry",
        )
        self.deleted_entry.soft_delete(self.owner)
        self.other_project_entry = FinancialEntry.objects.create(
            project=self.other_project,
            created_by=self.other_user,
            amount="800.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Other project chart entry",
        )

        self.set_created_at(self.january_expense, datetime(2026, 1, 5, 12, 0))
        self.set_created_at(self.january_refund, datetime(2026, 1, 20, 12, 0))
        self.set_created_at(self.february_expense, datetime(2026, 2, 3, 12, 0))
        self.set_created_at(self.deleted_entry, datetime(2026, 2, 4, 12, 0))
        self.set_created_at(self.other_project_entry, datetime(2026, 1, 5, 12, 0))

        self.url = f"/api/projects/{self.project.id}/financial-entries/chart/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/financial-entries/chart/"

    # GIVEN
    def set_created_at(self, entry, value):
        FinancialEntry.all_objects.filter(pk=entry.pk).update(
            created_at=timezone.make_aware(value),
        )

    # WHEN
    def when_get_financial_chart(self, query=""):
        return self.api_get(f"{self.url}{query}")

    # TESTS GET
    def test_anonymous_cannot_get_financial_chart(self):
        response = self.when_get_financial_chart()

        self.assert_unauthorized(response)

    def test_owner_can_get_financial_chart_data(self):
        self.given_authenticated(self.owner)

        response = self.when_get_financial_chart()

        self.assert_ok(response)
        data = self.response_data(response)
        self.assertEqual(data["group_by"], "month")
        self.assertIsNone(data["start_date"])
        self.assertIsNone(data["end_date"])
        self.assertEqual(data["totals"], {
            "count": 3,
            "expenses": "150.00",
            "refunds": "25.00",
            "balance": "125.00",
        })
        self.assertEqual(data["series"], [
            {
                "period": "2026-01",
                "count": 2,
                "expenses": "100.00",
                "refunds": "25.00",
                "balance": "75.00",
            },
            {
                "period": "2026-02",
                "count": 1,
                "expenses": "50.00",
                "refunds": "0.00",
                "balance": "50.00",
            },
        ])
        self.assertEqual(data["sources"], [
            {
                "source": "labor",
                "count": 1,
                "expenses": "50.00",
                "refunds": "0.00",
                "balance": "50.00",
            },
            {
                "source": "manual",
                "count": 2,
                "expenses": "100.00",
                "refunds": "25.00",
                "balance": "75.00",
            },
        ])

    def test_chart_zero_fills_months_with_no_entries(self):
        self.given_authenticated(self.owner)

        response = self.when_get_financial_chart("?start_date=2026-01-01&end_date=2026-03-31")

        self.assert_ok(response)
        data = self.response_data(response)
        self.assertEqual(
            [entry["period"] for entry in data["series"]],
            ["2026-01", "2026-02", "2026-03"],
        )
        self.assertEqual(data["series"][2], {
            "period": "2026-03",
            "count": 0,
            "expenses": "0.00",
            "refunds": "0.00",
            "balance": "0.00",
        })

    def test_member_with_finance_view_can_get_financial_chart(self):
        self.given_member_authenticated(["finance.view"])

        response = self.when_get_financial_chart()

        self.assert_ok(response)

    def test_member_without_finance_view_cannot_get_financial_chart(self):
        self.given_member_authenticated(["finance.edit"])

        response = self.when_get_financial_chart()

        self.assert_forbidden(response)

    def test_member_cannot_get_another_project_financial_chart(self):
        self.given_member_authenticated(["finance.view"])
        self.url = self.other_project_url

        response = self.when_get_financial_chart()

        self.assert_forbidden(response)

    def test_chart_can_group_by_day_and_filter_date_range(self):
        self.given_authenticated(self.owner)

        response = self.when_get_financial_chart(
            "?group_by=day&start_date=2026-02-01&end_date=2026-02-28"
        )

        self.assert_ok(response)
        data = self.response_data(response)
        self.assertEqual(data["group_by"], "day")
        self.assertEqual(data["start_date"], "2026-02-01")
        self.assertEqual(data["end_date"], "2026-02-28")
        self.assertEqual(data["totals"], {
            "count": 1,
            "expenses": "50.00",
            "refunds": "0.00",
            "balance": "50.00",
        })
        # `series` now covers every day in the requested range (not just days
        # with entries), so the timeline has no gaps.
        expected_series = [
            {"period": f"2026-02-{day:02d}", "count": 0, "expenses": "0.00", "refunds": "0.00", "balance": "0.00"}
            for day in range(1, 29)
        ]
        expected_series[2] = {
            "period": "2026-02-03",
            "count": 1,
            "expenses": "50.00",
            "refunds": "0.00",
            "balance": "50.00",
        }
        self.assertEqual(data["series"], expected_series)

    def test_chart_rejects_end_date_before_start_date(self):
        self.given_authenticated(self.owner)

        response = self.when_get_financial_chart(
            "?start_date=2026-02-28&end_date=2026-02-01"
        )

        self.assert_bad_request(response)


class FinancialEntryDetailRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.time_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.owner,
            duration_minutes=60,
            hourly_rate="50.00",
            description="Finance detail time",
            start_date=timezone.now(),
        )
        self.entry = FinancialEntry.objects.create(
            project=self.project,
            created_by=self.owner,
            amount="120.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Target finance",
        )
        self.other_project_entry = FinancialEntry.objects.create(
            project=self.other_project,
            created_by=self.other_user,
            amount="120.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Other finance",
        )
        self.url = f"/api/projects/{self.project.id}/financial-entries/{self.entry.id}/"

    # WHEN
    def when_get_financial_entry(self):
        return self.api_get(self.url)

    def when_patch_financial_entry(self, payload):
        return self.api_patch(self.url, payload)

    def when_delete_financial_entry(self):
        return self.api_delete(self.url)

    # ASSERT
    def assert_financial_description(self, expected_description):
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.description, expected_description)

    def assert_financial_entry_not_deleted(self):
        self.entry.refresh_from_db()
        self.assertIsNone(self.entry.deleted_at)

    def assert_financial_amount(self, expected_amount):
        self.entry.refresh_from_db()
        self.assertEqual(str(self.entry.amount), expected_amount)

    def assert_financial_entry_deleted_by(self, user):
        self.entry.refresh_from_db()
        self.assertIsNotNone(self.entry.deleted_at)
        self.assertEqual(self.entry.deleted_by_id, user.id)

    # TESTS GET
    def test_anonymous_cannot_get_financial_entry(self):
        response = self.when_get_financial_entry()

        self.assert_unauthorized(response)

    def test_owner_can_get_financial_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_get_financial_entry()

        self.assert_ok(response)

    def test_member_with_finance_view_can_get_financial_entry(self):
        self.given_member_authenticated(["finance.view"])

        response = self.when_get_financial_entry()

        self.assert_ok(response)

    def test_member_without_finance_view_cannot_get_financial_entry(self):
        self.given_member_authenticated([])

        response = self.when_get_financial_entry()

        self.assert_forbidden(response)

    def test_non_member_cannot_get_financial_entry(self):
        self.given_authenticated(self.other_user)

        response = self.when_get_financial_entry()

        self.assert_forbidden(response)

    def test_member_cannot_get_financial_entry_from_another_project(self):
        self.given_member_authenticated(["finance.view"])
        self.url = f"/api/projects/{self.other_project.id}/financial-entries/{self.other_project_entry.id}/"

        response = self.when_get_financial_entry()

        self.assert_forbidden(response)

    # TESTS PATCH
    def test_owner_can_patch_financial_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_financial_entry({"description": "Owner edited finance"})

        self.assert_ok(response)
        self.assert_financial_description("Owner edited finance")

    def test_member_with_finance_edit_can_patch_financial_entry(self):
        self.given_member_authenticated(["finance.edit"])

        response = self.when_patch_financial_entry({"description": "Member edited finance"})

        self.assert_ok(response)
        self.assert_financial_description("Member edited finance")

    def test_member_without_finance_edit_cannot_patch_financial_entry(self):
        self.given_member_authenticated(["finance.view"])

        response = self.when_patch_financial_entry({"description": "Blocked edit"})

        self.assert_forbidden(response)
        self.assert_financial_description("Target finance")

    def test_patch_rejects_time_entry_overpayment(self):
        self.entry.time_entry = self.time_entry
        self.entry.amount = "25.00"
        self.entry.save()
        FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.time_entry,
            created_by=self.owner,
            amount="25.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Other detail time payment",
        )
        self.given_authenticated(self.owner)

        response = self.when_patch_financial_entry({"amount": "30.00"})

        self.assert_bad_request(response)
        self.assert_financial_amount("25.00")

    def test_patch_allows_valid_time_entry_payment_amount_change(self):
        self.entry.time_entry = self.time_entry
        self.entry.amount = "25.00"
        self.entry.save()
        self.given_authenticated(self.owner)

        response = self.when_patch_financial_entry({"amount": "40.00"})

        self.assert_ok(response)
        self.assert_financial_amount("40.00")

        time_response = self.api_get(
            f"/api/projects/{self.project.id}/time-entries/{self.time_entry.id}/"
        )
        self.assert_ok(time_response)
        time_entry_data = self.response_data(time_response)
        self.assertEqual(time_entry_data["paid_amount"], "40.00")
        self.assertEqual(time_entry_data["remaining_amount"], "10.00")

    # TESTS DELETE
    def test_owner_can_soft_delete_financial_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_delete_financial_entry()

        self.assert_no_content(response)
        self.assert_financial_entry_deleted_by(self.owner)

    def test_member_with_finance_delete_can_soft_delete_financial_entry(self):
        self.given_member_authenticated(["finance.delete"])

        response = self.when_delete_financial_entry()

        self.assert_no_content(response)
        self.assert_financial_entry_deleted_by(self.member)

    def test_member_without_finance_delete_cannot_delete_financial_entry(self):
        self.given_member_authenticated(["finance.edit"])

        response = self.when_delete_financial_entry()

        self.assert_forbidden(response)
        self.assert_financial_entry_not_deleted()

    def test_soft_delete_and_restore_updates_time_entry_payment_status(self):
        linked_entry = FinancialEntry.objects.create(
            project=self.project,
            time_entry=self.time_entry,
            created_by=self.owner,
            amount="50.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Linked full payment",
        )
        finance_url = f"/api/projects/{self.project.id}/financial-entries/{linked_entry.id}/"
        restore_url = f"/api/projects/{self.project.id}/financial-entries/{linked_entry.id}/restore/"
        time_url = f"/api/projects/{self.project.id}/time-entries/{self.time_entry.id}/"
        self.given_authenticated(self.owner)

        paid_response = self.api_get(time_url)
        self.assert_ok(paid_response)
        paid_data = self.response_data(paid_response)
        self.assertEqual(paid_data["paid_amount"], "50.00")
        self.assertEqual(paid_data["remaining_amount"], "0.00")

        delete_response = self.api_delete(finance_url)
        self.assert_no_content(delete_response)

        unpaid_response = self.api_get(time_url)
        self.assert_ok(unpaid_response)
        unpaid_data = self.response_data(unpaid_response)
        self.assertEqual(unpaid_data["paid_amount"], "0.00")
        self.assertEqual(unpaid_data["remaining_amount"], "50.00")

        restore_response = self.api_post(restore_url, {})
        self.assert_ok(restore_response)

        restored_response = self.api_get(time_url)
        self.assert_ok(restored_response)
        restored_data = self.response_data(restored_response)
        self.assertEqual(restored_data["paid_amount"], "50.00")
        self.assertEqual(restored_data["remaining_amount"], "0.00")


class FinancialEntryTrashRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.deleted_entry = FinancialEntry.objects.create(
            project=self.project,
            created_by=self.owner,
            amount="10.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Deleted finance",
        )
        self.deleted_entry.soft_delete(self.owner)
        self.other_project_deleted_entry = FinancialEntry.objects.create(
            project=self.other_project,
            created_by=self.other_user,
            amount="10.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Other deleted finance",
        )
        self.other_project_deleted_entry.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/financial-entries/trash/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/financial-entries/trash/"

    def when_list_deleted_financial_entries(self):
        return self.api_get(self.url)

    def assert_visible_financial_descriptions(self, response, expected_descriptions):
        entries = self.response_results(response)
        descriptions = {entry["description"] for entry in entries}
        self.assertEqual(descriptions, set(expected_descriptions))

    def test_owner_can_list_deleted_financial_entries(self):
        self.given_authenticated(self.owner)

        response = self.when_list_deleted_financial_entries()

        self.assert_ok(response)
        self.assert_visible_financial_descriptions(response, ["Deleted finance"])

    def test_anonymous_cannot_list_deleted_financial_entries(self):
        response = self.when_list_deleted_financial_entries()

        self.assert_unauthorized(response)

    def test_member_with_finance_restore_can_list_deleted_financial_entries(self):
        self.given_member_authenticated(["finance.restore"])

        response = self.when_list_deleted_financial_entries()

        self.assert_ok(response)
        self.assert_visible_financial_descriptions(response, ["Deleted finance"])

    def test_member_without_finance_restore_cannot_list_deleted_financial_entries(self):
        self.given_member_authenticated(["finance.view"])

        response = self.when_list_deleted_financial_entries()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_deleted_financial_entries(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_deleted_financial_entries()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_deleted_financial_entries(self):
        self.given_member_authenticated(["finance.view"])
        self.url = self.other_project_url

        response = self.when_list_deleted_financial_entries()

        self.assert_forbidden(response)


class FinancialEntryRestoreRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.deleted_entry = FinancialEntry.objects.create(
            project=self.project,
            created_by=self.owner,
            amount="10.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Deleted finance",
        )
        self.deleted_entry.soft_delete(self.owner)
        self.other_project_deleted_entry = FinancialEntry.objects.create(
            project=self.other_project,
            created_by=self.other_user,
            amount="10.00",
            type=FinancialEntry.FinancialType.EXPENSE,
            description="Other deleted finance",
        )
        self.other_project_deleted_entry.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/financial-entries/{self.deleted_entry.id}/restore/"

    def when_restore_financial_entry(self):
        return self.api_post(self.url, {})

    def assert_financial_entry_still_deleted(self):
        self.deleted_entry.refresh_from_db()
        self.assertIsNotNone(self.deleted_entry.deleted_at)

    def assert_financial_entry_restored(self):
        self.deleted_entry.refresh_from_db()
        self.assertIsNone(self.deleted_entry.deleted_at)
        self.assertIsNone(self.deleted_entry.deleted_by_id)

    def test_owner_can_restore_financial_entry(self):
        self.given_authenticated(self.owner)

        response = self.when_restore_financial_entry()

        self.assert_ok(response)
        self.assert_financial_entry_restored()

    def test_anonymous_cannot_restore_financial_entry(self):
        response = self.when_restore_financial_entry()

        self.assert_unauthorized(response)
        self.assert_financial_entry_still_deleted()

    def test_member_with_finance_restore_can_restore_financial_entry(self):
        self.given_member_authenticated(["finance.restore"])

        response = self.when_restore_financial_entry()

        self.assert_ok(response)
        self.assert_financial_entry_restored()

    def test_member_without_finance_restore_cannot_restore_financial_entry(self):
        self.given_member_authenticated(["finance.view"])

        response = self.when_restore_financial_entry()

        self.assert_forbidden(response)
        self.assert_financial_entry_still_deleted()

    def test_non_member_cannot_restore_financial_entry(self):
        self.given_authenticated(self.other_user)

        response = self.when_restore_financial_entry()

        self.assert_forbidden(response)
        self.assert_financial_entry_still_deleted()

    def test_member_cannot_restore_financial_entry_from_another_project(self):
        self.given_member_authenticated(["finance.restore"])
        self.url = (
            f"/api/projects/{self.other_project.id}/financial-entries/"
            f"{self.other_project_deleted_entry.id}/restore/"
        )

        response = self.when_restore_financial_entry()

        self.assert_forbidden(response)
        self.other_project_deleted_entry.refresh_from_db()
        self.assertIsNotNone(self.other_project_deleted_entry.deleted_at)

class ProjectDetailRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.url = f"/api/projects/{self.project.id}/"

    # WHEN
    def when_get_project(self):
        return self.api_get(self.url)

    def when_patch_project_name(self, name):
        return self.api_patch(self.url, {"name": name})

    def when_delete_project(self):
        return self.api_delete(self.url)

    # ASSERT
    def assert_project_name(self, expected_name):
        self.project.refresh_from_db()
        self.assertEqual(self.project.name, expected_name)

    def assert_project_not_deleted(self):
        self.project.refresh_from_db()
        self.assertIsNone(self.project.deleted_at)

    def assert_project_deleted_by(self, user):
        self.project.refresh_from_db()
        self.assertIsNotNone(self.project.deleted_at)
        self.assertEqual(self.project.deleted_by_id, user.id)

    # TESTS GET
    def test_anonymous_cannot_get_project(self):
        response = self.when_get_project()

        self.assert_unauthorized(response)

    def test_owner_can_get_project(self):
        self.given_authenticated(self.owner)

        response = self.when_get_project()

        self.assert_ok(response)

    def test_member_can_get_project_with_membership_only(self):
        self.given_member_authenticated([])

        response = self.when_get_project()

        self.assert_ok(response)

    def test_non_member_cannot_get_project(self):
        self.given_authenticated(self.other_user)

        response = self.when_get_project()

        self.assert_not_found(response)

    # TESTS PATCH
    def test_anonymous_cannot_patch_project(self):
        response = self.when_patch_project_name("Anonymous edit")

        self.assert_unauthorized(response)
        self.assert_project_name("Main project")
        self.assert_project_not_deleted()

    def test_owner_can_patch_project(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_project_name("Edited by owner")

        self.assert_ok(response)
        self.assert_project_name("Edited by owner")
        self.assert_project_not_deleted()

    def test_member_with_project_edit_can_patch_project(self):
        self.given_member_authenticated(["project.edit"])

        response = self.when_patch_project_name("Edited by member")

        self.assert_ok(response)
        self.assert_project_name("Edited by member")
        self.assert_project_not_deleted()

    def test_member_without_project_edit_cannot_patch_project(self):
        self.given_member_authenticated([])

        response = self.when_patch_project_name("Blocked edit")

        self.assert_forbidden(response)
        self.assert_project_name("Main project")
        self.assert_project_not_deleted()

    def test_non_member_cannot_patch_project(self):
        self.given_authenticated(self.other_user)

        response = self.when_patch_project_name("Non member edit")

        self.assert_not_found(response)
        self.assert_project_name("Main project")
        self.assert_project_not_deleted()

    # TESTS DELETE
    def test_anonymous_cannot_delete_project(self):
        response = self.when_delete_project()

        self.assert_unauthorized(response)
        self.assert_project_not_deleted()

    def test_owner_can_soft_delete_project(self):
        self.given_authenticated(self.owner)

        response = self.when_delete_project()

        self.assert_no_content(response)
        self.assert_project_deleted_by(self.owner)

    def test_member_with_project_edit_cannot_delete_project(self):
        self.given_member_authenticated(["project.edit"])

        response = self.when_delete_project()

        self.assert_forbidden(response)
        self.assert_project_not_deleted()

    def test_non_member_cannot_delete_project(self):
        self.given_authenticated(self.other_user)

        response = self.when_delete_project()

        self.assert_not_found(response)
        self.assert_project_not_deleted()

class RoleRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.url = f"/api/projects/{self.project.id}/roles/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/roles/"
        self.permission = self.given_permission(
            code="file.view",
            name="File view",
            description="File view",
        )
        self.active_role = Role.objects.create(
            project=self.project,
            name="Active role",
        )
        self.deleted_role = Role.objects.create(
            project=self.project,
            name="Deleted role",
        )
        self.deleted_role.soft_delete(self.owner)

    # WHEN
    def when_list_roles(self, url=None, query=""):
        return self.api_get(f"{url or self.url}{query}")

    def when_create_role(self, payload, url=None):
        return self.api_post(url or self.url, payload)

    # ASSERT
    def assert_visible_role_names(self, response, expected_names):
        roles = self.response_results(response)
        role_names = {role["name"] for role in roles}
        self.assertEqual(role_names, set(expected_names))

    def assert_role_exists(self, name, project=None):
        project = project or self.project
        return Role.objects.get(project=project, name=name)

    def assert_role_does_not_exist(self, name):
        self.assertFalse(Role.objects.filter(name=name).exists())

    def assert_role_permission_codes(self, role, expected_codes):
        permission_codes = set(
            Permission.objects.filter(
                rolepermission__role=role,
                rolepermission__deleted_at__isnull=True,
            ).values_list("code", flat=True)
        )
        self.assertEqual(permission_codes, set(expected_codes))

    # TESTS GET
    def test_anonymous_cannot_list_roles(self):
        response = self.when_list_roles()

        self.assert_unauthorized(response)

    def test_owner_can_list_active_roles(self):
        self.given_authenticated(self.owner)

        response = self.when_list_roles()

        self.assert_ok(response)
        self.assert_visible_role_names(response, ["Active role"])

    def test_member_with_role_view_can_list_roles(self):
        self.given_member_authenticated(["role.view"])

        response = self.when_list_roles()

        self.assert_ok(response)
        self.assert_visible_role_names(response, ["Active role", "Role for member"])

    def test_member_without_role_view_cannot_list_roles(self):
        self.given_member_authenticated(["role.edit"])

        response = self.when_list_roles()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_roles(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_roles()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_roles(self):
        self.given_member_authenticated(["role.view"])

        response = self.when_list_roles(self.other_project_url)

        self.assert_forbidden(response)

    def test_list_can_search_roles(self):
        Role.objects.create(
            project=self.project,
            name="Searchable role",
            description="Needle role",
        )
        self.given_authenticated(self.owner)

        response = self.when_list_roles(query="?search=Needle")

        self.assert_ok(response)
        self.assert_visible_role_names(response, ["Searchable role"])

    # TESTS POST
    def test_anonymous_cannot_create_role(self):
        response = self.when_create_role({
            "name": "Anonymous role",
        })

        self.assert_unauthorized(response)
        self.assert_role_does_not_exist("Anonymous role")

    def test_owner_can_create_role(self):
        self.given_authenticated(self.owner)

        response = self.when_create_role({
            "name": "Created by owner",
            "permission_ids": [self.permission.id],
        })

        self.assert_created(response)
        role = self.assert_role_exists("Created by owner")
        self.assert_role_permission_codes(role, ["file.view"])

    def test_member_with_role_edit_can_create_role(self):
        self.given_member_authenticated(["role.edit"])

        response = self.when_create_role({
            "name": "Created by member",
        })

        self.assert_created(response)
        self.assert_role_exists("Created by member")

    def test_member_without_role_edit_cannot_create_role(self):
        self.given_member_authenticated(["role.view"])

        response = self.when_create_role({
            "name": "Blocked role",
        })

        self.assert_forbidden(response)
        self.assert_role_does_not_exist("Blocked role")

    def test_non_member_cannot_create_role(self):
        self.given_authenticated(self.other_user)

        response = self.when_create_role({
            "name": "Non member role",
        })

        self.assert_forbidden(response)
        self.assert_role_does_not_exist("Non member role")

    def test_create_role_deduplicates_permission_ids(self):
        self.given_authenticated(self.owner)

        response = self.when_create_role({
            "name": "Role with duplicate permissions",
            "permission_ids": [self.permission.id, self.permission.id],
        })

        self.assert_created(response)
        role = self.assert_role_exists("Role with duplicate permissions")
        self.assert_role_permission_codes(role, ["file.view"])

    def test_create_role_adds_permission_dependencies(self):
        time_pay_permission = self.given_permission("time_entry.pay")
        self.given_permission("time_entry.view")
        self.given_permission("time_entry.view_all")
        self.given_authenticated(self.owner)

        response = self.when_create_role({
            "name": "Payroll role",
            "permission_ids": [time_pay_permission.id],
        })

        self.assert_created(response)
        role = self.assert_role_exists("Payroll role")
        self.assert_role_permission_codes(
            role,
            ["time_entry.pay", "time_entry.view", "time_entry.view_all"],
        )

    def test_create_role_uses_project_from_url_not_payload(self):
        self.given_authenticated(self.owner)

        response = self.when_create_role({
            "project": self.other_project.id,
            "name": "Payload project ignored",
        })

        self.assert_created(response)
        role = self.assert_role_exists("Payload project ignored")
        self.assertEqual(role.project_id, self.project.id)

class RoleDetailRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.permission = self.given_permission(
            code="file.view",
            name="File view",
            description="File view",
        )
        self.other_permission = self.given_permission(
            code="file.edit",
            name="File edit",
            description="File edit",
        )
        self.target_role = Role.objects.create(
            project=self.project,
            name="Target role",
        )
        RolePermission.objects.create(
            role=self.target_role,
            permission=self.permission,
        )
        self.other_project_role = Role.objects.create(
            project=self.other_project,
            name="Other project role",
        )

        self.url = f"/api/projects/{self.project.id}/roles/{self.target_role.id}/"

    # WHEN
    def when_get_role(self):
        return self.api_get(self.url)

    def when_patch_role_name(self, name):
        return self.api_patch(self.url, {"name": name})

    def when_patch_role(self, payload):
        return self.api_patch(self.url, payload)

    def when_delete_role(self):
        return self.api_delete(self.url)

    # ASSERT
    def assert_role_name(self, expected_name):
        self.target_role.refresh_from_db()
        self.assertEqual(self.target_role.name, expected_name)

    def assert_role_not_deleted(self):
        self.target_role.refresh_from_db()
        self.assertIsNone(self.target_role.deleted_at)

    def assert_role_deleted_by(self, user):
        self.target_role.refresh_from_db()
        self.assertIsNotNone(self.target_role.deleted_at)
        self.assertEqual(self.target_role.deleted_by_id, user.id)

    def assert_role_permission_codes(self, expected_codes):
        permission_codes = set(
            Permission.objects.filter(
                rolepermission__role=self.target_role,
                rolepermission__deleted_at__isnull=True,
            ).values_list("code", flat=True)
        )
        self.assertEqual(permission_codes, set(expected_codes))

    # TESTS GET
    def test_anonymous_cannot_get_role(self):
        response = self.when_get_role()

        self.assert_unauthorized(response)

    def test_owner_can_get_role(self):
        self.given_authenticated(self.owner)

        response = self.when_get_role()

        self.assert_ok(response)

    def test_member_with_role_view_can_get_role(self):
        self.given_member_authenticated(["role.view"])

        response = self.when_get_role()

        self.assert_ok(response)

    def test_member_without_role_view_cannot_get_role(self):
        self.given_member_authenticated([])

        response = self.when_get_role()

        self.assert_forbidden(response)

    def test_non_member_cannot_get_role(self):
        self.given_authenticated(self.other_user)

        response = self.when_get_role()

        self.assert_forbidden(response)

    def test_member_cannot_get_role_from_another_project(self):
        self.given_member_authenticated(["role.view"])
        self.url = f"/api/projects/{self.other_project.id}/roles/{self.other_project_role.id}/"

        response = self.when_get_role()

        self.assert_forbidden(response)

    # TESTS PATCH
    def test_anonymous_cannot_patch_role(self):
        response = self.when_patch_role_name("Anonymous role edit")

        self.assert_unauthorized(response)
        self.assert_role_name("Target role")

    def test_owner_can_patch_role(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_role_name("Edited by owner")

        self.assert_ok(response)
        self.assert_role_name("Edited by owner")
        self.assert_role_not_deleted()

    def test_member_with_role_edit_can_patch_role(self):
        self.given_member_authenticated(["role.view", "role.edit"])

        response = self.when_patch_role_name("Edited role")

        self.assert_ok(response)
        self.assert_role_name("Edited role")
        self.assert_role_not_deleted()

    def test_member_without_role_edit_cannot_patch_role(self):
        self.given_member_authenticated(["role.view"])

        response = self.when_patch_role_name("Blocked role edit")

        self.assert_forbidden(response)
        self.assert_role_name("Target role")
        self.assert_role_not_deleted()

    def test_patch_role_deduplicates_permission_ids(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_role({
            "permission_ids": [self.other_permission.id, self.other_permission.id],
        })

        self.assert_ok(response)
        self.assert_role_permission_codes(["file.edit", "file.view"])

    def test_patch_role_replaces_permissions(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_role({
            "permission_ids": [self.other_permission.id],
        })

        self.assert_ok(response)
        self.assert_role_permission_codes(["file.edit", "file.view"])

    # TESTS DELETE
    def test_anonymous_cannot_delete_role(self):
        response = self.when_delete_role()

        self.assert_unauthorized(response)
        self.assert_role_not_deleted()

    def test_owner_can_soft_delete_role(self):
        self.given_authenticated(self.owner)

        response = self.when_delete_role()

        self.assert_no_content(response)
        self.assert_role_deleted_by(self.owner)


    def test_member_with_role_delete_can_soft_delete_role(self):
        self.given_member_authenticated(["role.view", "role.delete"])

        response = self.when_delete_role()

        self.assert_no_content(response)
        self.assert_role_deleted_by(self.member)

    def test_member_without_role_delete_cannot_delete_role(self):
        self.given_member_authenticated(["role.view", "role.edit"])

        response = self.when_delete_role()

        self.assert_forbidden(response)
        self.assert_role_not_deleted()

class RoleTrashRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.active_role = Role.objects.create(
            project=self.project,
            name="Active role",
        )
        self.deleted_role = Role.objects.create(
            project=self.project,
            name="Deleted role",
        )
        self.deleted_role.soft_delete(self.owner)
        self.other_project_deleted_role = Role.objects.create(
            project=self.other_project,
            name="Other project deleted role",
        )
        self.other_project_deleted_role.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/roles/trash/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/roles/trash/"

    # WHEN
    def when_list_deleted_roles(self):
        return self.api_get(self.url)

    # ASSERT
    def assert_visible_role_names(self, response, expected_names):
        roles = self.response_results(response)
        role_names = {role["name"] for role in roles}
        self.assertEqual(role_names, set(expected_names))

    # TESTS GET
    def test_anonymous_cannot_list_deleted_roles(self):
        response = self.when_list_deleted_roles()

        self.assert_unauthorized(response)

    def test_owner_can_list_deleted_roles(self):
        self.given_authenticated(self.owner)

        response = self.when_list_deleted_roles()

        self.assert_ok(response)
        self.assert_visible_role_names(response, ["Deleted role"])

    def test_member_with_role_restore_can_list_deleted_roles(self):
        self.given_member_authenticated(["role.restore"])

        response = self.when_list_deleted_roles()

        self.assert_ok(response)
        self.assert_visible_role_names(response, ["Deleted role"])

    def test_member_with_role_view_only_cannot_list_deleted_roles(self):
        self.given_member_authenticated(["role.view"])

        response = self.when_list_deleted_roles()

        self.assert_forbidden(response)

    def test_member_without_role_view_cannot_list_deleted_roles(self):
        self.given_member_authenticated([])

        response = self.when_list_deleted_roles()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_deleted_roles(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_deleted_roles()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_deleted_roles(self):
        self.given_member_authenticated(["role.view"])
        self.url = self.other_project_url

        response = self.when_list_deleted_roles()

        self.assert_forbidden(response)

class RoleRestoreRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.deleted_role = Role.objects.create(
            project=self.project,
            name="Deleted role",
        )
        self.deleted_role.soft_delete(self.owner)
        self.other_project_deleted_role = Role.objects.create(
            project=self.other_project,
            name="Other project deleted role",
        )
        self.other_project_deleted_role.soft_delete(self.other_user)
        self.url = f"/api/projects/{self.project.id}/roles/{self.deleted_role.id}/restore/"

    # WHEN
    def when_restore_role(self):
        return self.api_post(self.url, {})

    # ASSERT
    def assert_role_still_deleted(self):
        self.deleted_role.refresh_from_db()
        self.assertIsNotNone(self.deleted_role.deleted_at)

    def assert_role_restored(self):
        self.deleted_role.refresh_from_db()
        self.assertIsNone(self.deleted_role.deleted_at)
        self.assertIsNone(self.deleted_role.deleted_by_id)

    # TESTS POST
    def test_anonymous_cannot_restore_role(self):
        response = self.when_restore_role()

        self.assert_unauthorized(response)
        self.assert_role_still_deleted()

    def test_owner_can_restore_role(self):
        self.given_authenticated(self.owner)

        response = self.when_restore_role()

        self.assert_ok(response)
        self.assert_role_restored()

    def test_member_with_role_restore_can_restore_role(self):
        self.given_member_authenticated(["role.restore"])

        response = self.when_restore_role()

        self.assert_ok(response)
        self.assert_role_restored()

    def test_member_without_role_restore_cannot_restore_role(self):
        self.given_member_authenticated(["role.view"])

        response = self.when_restore_role()

        self.assert_forbidden(response)
        self.assert_role_still_deleted()

    def test_non_member_cannot_restore_role(self):
        self.given_authenticated(self.other_user)

        response = self.when_restore_role()

        self.assert_forbidden(response)
        self.assert_role_still_deleted()

    def test_member_cannot_restore_role_from_another_project(self):
        self.given_member_authenticated(["role.restore"])
        self.url = (
            f"/api/projects/{self.other_project.id}/roles/"
            f"{self.other_project_deleted_role.id}/restore/"
        )

        response = self.when_restore_role()

        self.assert_forbidden(response)
        self.other_project_deleted_role.refresh_from_db()
        self.assertIsNotNone(self.other_project_deleted_role.deleted_at)


class DeletedRoleRevokesPermissionTests(ProjectApiTestCase):
    """A soft-deleted role must stop granting access to members still assigned to
    it — deleting a role is a soft, reversible action like everywhere else in the
    app, but it must take effect immediately, not only once members are manually
    reassigned."""

    def setUp(self):
        super().setUp()
        self.role = self.given_member_with_permissions(["task.view"])
        self.role.soft_delete(self.owner)
        self.url = f"/api/projects/{self.project.id}/tasks/"

    def test_member_loses_access_when_their_role_is_deleted(self):
        self.given_authenticated(self.member)

        response = self.api_get(self.url)

        self.assert_forbidden(response)

    def test_has_project_permission_returns_false_for_deleted_role(self):
        from .authorization import ProjectAuthorization

        auth = ProjectAuthorization(self.member, self.project)
        self.assertFalse(auth.has("task.view"))
        self.assertEqual(auth.codes(), [])

    def test_get_project_permission_codes_map_excludes_deleted_role(self):
        from .authorization import ProjectAuthorizationMap

        permission_map = ProjectAuthorizationMap(self.member, [self.project])

        self.assertEqual(permission_map.codes_for(self.project), [])


class ProjectMemberRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.target_role = Role.objects.create(
            project=self.project,
            name="Target member role",
        )
        self.target_member = ProjectMember.objects.create(
            project=self.project,
            user=self.other_user,
            role=self.target_role,
        )
        self.url = f"/api/projects/{self.project.id}/members/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/members/"

    # WHEN
    def when_list_members(self, url=None, query=""):
        return self.api_get(f"{url or self.url}{query}")

    # ASSERT
    def assert_visible_member_user_ids(self, response, expected_user_ids):
        members = self.response_results(response)
        member_user_ids = {member["user"] for member in members}
        self.assertEqual(member_user_ids, set(expected_user_ids))

    # TESTS GET
    def test_anonymous_cannot_list_members(self):
        response = self.when_list_members()

        self.assert_unauthorized(response)

    def test_owner_can_list_members(self):
        self.given_authenticated(self.owner)

        response = self.when_list_members()

        self.assert_ok(response)
        self.assert_visible_member_user_ids(response, [self.owner.id, self.other_user.id])

    def test_member_with_member_view_can_list_members(self):
        self.given_member_authenticated(["member.view"])

        response = self.when_list_members()

        self.assert_ok(response)
        self.assert_visible_member_user_ids(response, [self.owner.id, self.member.id, self.other_user.id])

    def test_member_without_member_view_cannot_list_members(self):
        self.given_member_authenticated([])

        response = self.when_list_members()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_members(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_members()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_members(self):
        self.given_member_authenticated(["member.view"])

        response = self.when_list_members(self.other_project_url)

        self.assert_forbidden(response)

    def test_list_can_filter_members_by_role(self):
        self.given_authenticated(self.owner)

        response = self.when_list_members(query=f"?role={self.target_role.id}")

        self.assert_ok(response)
        self.assert_visible_member_user_ids(response, [self.other_user.id])

    def test_list_can_search_members_by_username(self):
        self.given_authenticated(self.owner)

        response = self.when_list_members(query="?search=other")

        self.assert_ok(response)
        self.assert_visible_member_user_ids(response, [self.other_user.id])


class ProjectMemberDetailRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.target_role = Role.objects.create(
            project=self.project,
            name="Target member role",
        )
        self.other_project_role = Role.objects.create(
            project=self.other_project,
            name="Other project member role",
        )
        self.target_member = ProjectMember.objects.create(
            project=self.project,
            user=self.other_user,
            role=self.target_role,
        )
        self.other_project_member = ProjectMember.objects.create(
            project=self.other_project,
            user=self.member,
            role=self.other_project_role,
        )
        self.url = f"/api/projects/{self.project.id}/members/{self.target_member.id}/"

    # WHEN
    def when_get_member(self):
        return self.api_get(self.url)

    def when_patch_member(self, payload):
        return self.api_patch(self.url, payload)

    def when_delete_member(self):
        return self.api_delete(self.url)

    # ASSERT
    def assert_member_role(self, role):
        self.target_member.refresh_from_db()
        self.assertEqual(self.target_member.role_id, role.id)

    def assert_member_not_deleted(self):
        self.target_member.refresh_from_db()
        self.assertIsNone(self.target_member.deleted_at)

    def assert_member_deleted_by(self, user):
        self.target_member.refresh_from_db()
        self.assertIsNotNone(self.target_member.deleted_at)
        self.assertEqual(self.target_member.deleted_by_id, user.id)

    # TESTS GET
    def test_get_member_marks_deleted_role(self):
        self.target_role.soft_delete(self.owner)
        self.given_authenticated(self.owner)

        response = self.when_get_member()

        self.assert_ok(response)
        data = self.response_data(response)
        self.assertTrue(data["role_deleted"])
        self.assertIsNone(data["role_name"])

    # TESTS PATCH
    def test_owner_can_patch_member_role(self):
        next_role = Role.objects.create(project=self.project, name="Next role")
        self.given_authenticated(self.owner)

        response = self.when_patch_member({"role": next_role.id})

        self.assert_ok(response)
        self.assert_member_role(next_role)

    def test_member_with_member_edit_can_patch_member_role(self):
        next_role = Role.objects.create(project=self.project, name="Next role")
        self.given_member_authenticated(["member.edit"])

        response = self.when_patch_member({"role": next_role.id})

        self.assert_ok(response)
        self.assert_member_role(next_role)

    def test_member_without_member_edit_cannot_patch_member_role(self):
        next_role = Role.objects.create(project=self.project, name="Next role")
        self.given_member_authenticated(["member.view"])

        response = self.when_patch_member({"role": next_role.id})

        self.assert_forbidden(response)
        self.assert_member_role(self.target_role)

    def test_patch_rejects_role_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_member({"role": self.other_project_role.id})

        self.assert_bad_request(response)
        self.assert_member_role(self.target_role)

    # TESTS DELETE
    def test_anonymous_cannot_delete_member(self):
        response = self.when_delete_member()

        self.assert_unauthorized(response)
        self.assert_member_not_deleted()

    def test_owner_can_soft_delete_member(self):
        self.given_authenticated(self.owner)

        response = self.when_delete_member()

        self.assert_no_content(response)
        self.assert_member_deleted_by(self.owner)

    def test_member_with_member_edit_can_soft_delete_member(self):
        self.given_member_authenticated(["member.edit"])

        response = self.when_delete_member()

        self.assert_no_content(response)
        self.assert_member_deleted_by(self.member)

    def test_member_without_member_edit_cannot_delete_member(self):
        self.given_member_authenticated(["member.view"])

        response = self.when_delete_member()

        self.assert_forbidden(response)
        self.assert_member_not_deleted()

    def test_non_member_cannot_delete_member(self):
        self.given_authenticated(self.other_user)

        response = self.when_delete_member()

        self.assert_forbidden(response)
        self.assert_member_not_deleted()

    def test_member_cannot_delete_member_from_another_project(self):
        self.given_member_authenticated(["member.edit"])
        self.url = f"/api/projects/{self.other_project.id}/members/{self.other_project_member.id}/"

        response = self.when_delete_member()

        self.assert_forbidden(response)
        self.other_project_member.refresh_from_db()
        self.assertIsNone(self.other_project_member.deleted_at)


class ProjectOwnerRateRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.url = f"/api/projects/{self.project.id}/owner-rate/"

    def when_patch_owner_rate(self, payload):
        return self.api_patch(self.url, payload)

    def test_anonymous_cannot_patch_owner_rate(self):
        response = self.when_patch_owner_rate({"hourly_rate": "60.00"})

        self.assert_unauthorized(response)

    def test_owner_can_patch_owner_rate(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_owner_rate({"hourly_rate": "60.00"})

        self.assert_ok(response)
        self.assertEqual(self.response_data(response)["hourly_rate"], "60.00")

    def test_member_cannot_patch_owner_rate(self):
        self.given_member_authenticated(["member.edit", "member.edit_rates"])

        response = self.when_patch_owner_rate({"hourly_rate": "60.00"})

        self.assert_forbidden(response)

    def test_non_member_cannot_patch_owner_rate(self):
        self.given_authenticated(self.other_user)

        response = self.when_patch_owner_rate({"hourly_rate": "60.00"})

        self.assert_forbidden(response)

    def test_owner_cannot_patch_owner_rate_of_another_project(self):
        self.given_authenticated(self.owner)
        self.url = f"/api/projects/{self.other_project.id}/owner-rate/"

        response = self.when_patch_owner_rate({"hourly_rate": "60.00"})

        self.assert_forbidden(response)

    def test_patch_rejects_missing_hourly_rate(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_owner_rate({})

        self.assert_bad_request(response)


class ExpenseRequestRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.folder = Folder.objects.create(
            project=self.project,
            name="Expense folder",
        )
        self.other_project_folder = Folder.objects.create(
            project=self.other_project,
            name="Other expense folder",
        )
        self.document = Document.objects.create(
            project=self.project,
            folder=self.folder,
            name="Receipt",
            file_id="receipt-file-er",
            file_name="receipt.pdf",
        )
        self.pending_request = ExpenseRequest.objects.create(
            project=self.project,
            title="Pending request",
            amount="50.00",
            category="transport",
            description="Bus ticket",
            folder=self.folder,
            requested_by=self.owner,
        )
        self.approved_request = ExpenseRequest.objects.create(
            project=self.project,
            title="Approved request",
            amount="100.00",
            status=ExpenseRequest.Status.APPROVED,
            requested_by=self.owner,
            approved_by=self.owner,
        )
        self.other_project_request = ExpenseRequest.objects.create(
            project=self.other_project,
            title="Other project request",
            amount="75.00",
            requested_by=self.other_user,
        )
        self.url = f"/api/projects/{self.project.id}/expense-requests/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/expense-requests/"

    # WHEN
    def when_list_requests(self, query=""):
        return self.api_get(f"{self.url}{query}")

    def when_create_request(self, payload):
        return self.api_post(self.url, payload)

    def when_get_request(self, request_id):
        return self.api_get(f"{self.url}{request_id}/")

    def when_patch_request(self, request_id, payload):
        return self.api_patch(f"{self.url}{request_id}/", payload)

    def when_delete_request(self, request_id):
        return self.api_delete(f"{self.url}{request_id}/")

    def when_approve_request(self, request_id):
        return self.api_post(f"{self.url}{request_id}/approve/", {})

    # ASSERT
    def assert_visible_request_titles(self, response, expected_titles):
        requests = self.response_results(response)
        titles = {r["title"] for r in requests}
        self.assertEqual(titles, set(expected_titles))

    def assert_request_exists(self, title):
        return ExpenseRequest.objects.get(project=self.project, title=title)

    def assert_request_does_not_exist(self, title):
        self.assertFalse(ExpenseRequest.objects.filter(project=self.project, title=title).exists())

    # TESTS GET list
    def test_anonymous_cannot_list_expense_requests(self):
        response = self.when_list_requests()

        self.assert_unauthorized(response)

    def test_owner_can_list_expense_requests(self):
        self.given_authenticated(self.owner)

        response = self.when_list_requests()

        self.assert_ok(response)
        self.assert_visible_request_titles(response, ["Pending request", "Approved request"])

    def test_member_with_view_can_list_expense_requests(self):
        self.given_member_authenticated(["expense_request.view"])

        response = self.when_list_requests()

        self.assert_ok(response)
        self.assert_visible_request_titles(response, ["Pending request", "Approved request"])

    def test_member_without_view_cannot_list_expense_requests(self):
        self.given_member_authenticated(["expense_request.edit"])

        response = self.when_list_requests()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_expense_requests(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_requests()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_requests(self):
        self.given_member_authenticated(["expense_request.view"])
        self.url = self.other_project_url

        response = self.when_list_requests()

        self.assert_forbidden(response)

    # TESTS POST
    def test_anonymous_cannot_create_expense_request(self):
        response = self.when_create_request({
            "title": "Anonymous request",
            "amount": "20.00",
        })

        self.assert_unauthorized(response)
        self.assert_request_does_not_exist("Anonymous request")

    def test_owner_can_create_expense_request(self):
        self.given_authenticated(self.owner)

        response = self.when_create_request({
            "title": "Owner request",
            "amount": "30.00",
            "category": "office",
            "description": "Paper",
            "folder": self.folder.id,
        })

        self.assert_created(response)
        req = self.assert_request_exists("Owner request")
        self.assertEqual(req.requested_by_id, self.owner.id)
        self.assertEqual(req.status, ExpenseRequest.Status.PENDING)

    def test_member_with_edit_can_create_expense_request(self):
        self.given_member_authenticated(["expense_request.view", "expense_request.edit"])

        response = self.when_create_request({
            "title": "Member request",
            "amount": "15.00",
        })

        self.assert_created(response)
        req = self.assert_request_exists("Member request")
        self.assertEqual(req.requested_by_id, self.member.id)

    def test_member_without_edit_cannot_create_expense_request(self):
        self.given_member_authenticated(["expense_request.view"])

        response = self.when_create_request({
            "title": "Forbidden request",
            "amount": "10.00",
        })

        self.assert_forbidden(response)
        self.assert_request_does_not_exist("Forbidden request")

    def test_create_rejects_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_request({
            "title": "Cross-project folder",
            "amount": "10.00",
            "folder": self.other_project_folder.id,
        })

        self.assert_bad_request(response)
        self.assert_request_does_not_exist("Cross-project folder")

    # TESTS PATCH
    def test_owner_can_patch_pending_expense_request(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_request(self.pending_request.id, {"title": "Updated title"})

        self.assert_ok(response)
        self.pending_request.refresh_from_db()
        self.assertEqual(self.pending_request.title, "Updated title")

    def test_member_without_edit_cannot_patch_expense_request(self):
        self.given_member_authenticated(["expense_request.view"])

        response = self.when_patch_request(self.pending_request.id, {"title": "Should not update"})

        self.assert_forbidden(response)

    # TESTS DELETE
    def test_anonymous_cannot_delete_expense_request(self):
        response = self.when_delete_request(self.pending_request.id)

        self.assert_unauthorized(response)
        self.assertIsNone(self.pending_request.deleted_at)

    def test_owner_can_soft_delete_expense_request(self):
        self.given_authenticated(self.owner)

        response = self.when_delete_request(self.pending_request.id)

        self.assert_no_content(response)
        self.pending_request.refresh_from_db()
        self.assertIsNotNone(self.pending_request.deleted_at)

    def test_member_without_delete_cannot_delete_expense_request(self):
        self.given_member_authenticated(["expense_request.view"])

        response = self.when_delete_request(self.pending_request.id)

        self.assert_forbidden(response)

    # TESTS APPROVE
    def test_anonymous_cannot_approve_expense_request(self):
        response = self.when_approve_request(self.pending_request.id)

        self.assert_unauthorized(response)
        self.pending_request.refresh_from_db()
        self.assertEqual(self.pending_request.status, ExpenseRequest.Status.PENDING)

    def test_owner_can_approve_pending_expense_request(self):
        self.given_authenticated(self.owner)

        response = self.when_approve_request(self.pending_request.id)

        self.assert_ok(response)
        self.pending_request.refresh_from_db()
        self.assertEqual(self.pending_request.status, ExpenseRequest.Status.APPROVED)
        self.assertEqual(self.pending_request.approved_by_id, self.owner.id)
        self.assertIsNotNone(self.pending_request.approved_at)

    def test_approve_creates_financial_entry(self):
        self.given_authenticated(self.owner)

        before_count = FinancialEntry.objects.filter(project=self.project).count()

        self.when_approve_request(self.pending_request.id)

        after_count = FinancialEntry.objects.filter(project=self.project).count()
        self.assertEqual(after_count, before_count + 1)

        entry = FinancialEntry.objects.get(
            project=self.project,
            description=self.pending_request.title,
        )
        self.assertEqual(entry.type, FinancialEntry.FinancialType.EXPENSE)
        self.assertEqual(str(entry.amount), self.pending_request.amount)
        self.assertEqual(entry.folder_id, self.pending_request.folder_id)
        self.assertIsNone(entry.time_entry_id)

    def test_member_with_approve_permission_can_approve(self):
        self.given_member_authenticated(["expense_request.view", "expense_request.approve"])

        response = self.when_approve_request(self.pending_request.id)

        self.assert_ok(response)
        self.pending_request.refresh_from_db()
        self.assertEqual(self.pending_request.status, ExpenseRequest.Status.APPROVED)

    def test_member_without_approve_cannot_approve(self):
        self.given_member_authenticated(["expense_request.view"])

        response = self.when_approve_request(self.pending_request.id)

        self.assert_forbidden(response)
        self.pending_request.refresh_from_db()
        self.assertEqual(self.pending_request.status, ExpenseRequest.Status.PENDING)

    def test_cannot_approve_already_approved_request(self):
        self.given_authenticated(self.owner)

        response = self.when_approve_request(self.approved_request.id)

        self.assert_not_found(response)

    def test_cannot_approve_request_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.api_post(f"{self.other_project_url}{self.other_project_request.id}/approve/", {})

        self.assert_forbidden(response)
