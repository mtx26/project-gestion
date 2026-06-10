from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import Folder, Permission, Project, ProjectMember, Role, RolePermission


class ProjectApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.owner = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="password",
        )
        self.member = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="password",
        )
        self.other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="password",
        )

        self.project = Project.objects.create(
            owner=self.owner,
            name="Main project",
            description="Main project description",
        )
        self.other_project = Project.objects.create(
            owner=self.other_user,
            name="Other project",
        )

    # GIVEN
    def given_authenticated(self, user):
        self.client.force_authenticate(user=user)

    def given_member_with_permissions(self, permissions, user=None, project=None):
        user = user or self.member
        project = project or self.project

        role = Role.objects.create(
            project=project,
            name=f"Role for {user.username}",
        )

        for code in permissions:
            permission, _ = Permission.objects.get_or_create(
                code=code,
                defaults={
                    "name": code,
                    "description": code,
                },
            )
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


class FolderRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.url = f"/api/projects/{self.project.id}/folders/"
        self.other_project_url = f"/api/projects/{self.other_project.id}/folders/"

        self.root_folder = Folder.objects.create(
            project=self.project,
            name="Root folder",
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
    def when_list_folders(self, url=None):
        return self.api_get(url or self.url)

    def when_create_folder(self, payload, url=None):
        return self.api_post(url or self.url, payload)

    # ASSERT
    def assert_visible_folder_names(self, response, expected_names):
        folders = self.response_results(response)
        folder_names = {folder["name"] for folder in folders}
        self.assertEqual(folder_names, set(expected_names))

    def assert_folder_exists(self, name, project=None, parent_folder=None):
        project = project or self.project

        folder = Folder.objects.get(
            project=project,
            name=name,
        )

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
        self.given_member_authenticated(["folder.view"])

        response = self.when_list_folders()

        self.assert_ok(response)
        self.assert_visible_folder_names(response, ["Root folder"])

    def test_member_without_folder_view_cannot_list_folders(self):
        self.given_member_authenticated(["folder.create"])

        response = self.when_list_folders()

        self.assert_forbidden(response)

    def test_non_member_cannot_list_folders(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_folders()

        self.assert_forbidden(response)

    def test_member_cannot_list_another_project_folders(self):
        self.given_member_authenticated(["folder.view", "folder.create"])

        response = self.when_list_folders(self.other_project_url)

        self.assert_forbidden(response)

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

    def test_member_with_folder_create_can_create_folder(self):
        self.given_member_authenticated(["folder.create"])

        response = self.when_create_folder({
            "name": "Created by member",
        })

        self.assert_created(response)
        self.assert_folder_exists("Created by member")

    def test_member_without_folder_create_cannot_create_folder(self):
        self.given_member_authenticated(["folder.view"])

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
    def test_create_rejects_parent_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_create_folder({
            "name": "Invalid child",
            "parent_folder": self.other_project_folder.id,
        })

        self.assert_bad_request(response)
        self.assert_folder_does_not_exist("Invalid child")

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
        self.url = f"/api/projects/{self.project.id}/folders/{self.folder.id}"

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

    def test_member_with_folder_view_can_get_folder(self):
        self.given_member_authenticated(["folder.view"])

        response = self.when_get_folder()

        self.assert_ok(response)

    def test_member_without_folder_view_cannot_get_folder(self):
        self.given_member_authenticated([])

        response = self.when_get_folder()

        self.assert_forbidden(response)

    # TESTS PATCH
    def test_member_without_folder_edit_cannot_patch_folder(self):
        self.given_member_authenticated(["folder.view"])

        response = self.when_patch_folder({"name": "Blocked folder edit"})

        self.assert_forbidden(response)
        self.assert_folder_name("Target folder")
        self.assert_folder_not_deleted()

    def test_member_with_folder_edit_can_patch_folder(self):
        self.given_member_authenticated(["folder.edit"])

        response = self.when_patch_folder({"name": "Edited folder"})

        self.assert_ok(response)
        self.assert_folder_name("Edited folder")
        self.assert_folder_not_deleted()

    def test_patch_rejects_parent_folder_from_another_project(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_folder({
            "parent_folder": self.other_project_folder.id,
        })

        self.assert_bad_request(response)
        self.folder.refresh_from_db()
        self.assertIsNone(self.folder.parent_folder_id)

    # TESTS DELETE
    def test_member_without_folder_delete_cannot_delete_folder(self):
        self.given_member_authenticated(["folder.edit"])

        response = self.when_delete_folder()

        self.assert_forbidden(response)
        self.assert_folder_not_deleted()

    def test_member_with_folder_delete_can_soft_delete_folder(self):
        self.given_member_authenticated(["folder.delete"])

        response = self.when_delete_folder()

        self.assert_no_content(response)
        self.assert_folder_deleted_by(self.member)


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
        self.url = f"/api/projects/{self.project.id}/folders/trash/"

    # WHEN
    def when_list_deleted_folders(self):
        return self.api_get(self.url)

    # ASSERT
    def assert_visible_folder_names(self, response, expected_names):
        folders = self.response_results(response)
        folder_names = {folder["name"] for folder in folders}
        self.assertEqual(folder_names, set(expected_names))

    # TESTS GET
    def test_member_without_folder_view_trash_cannot_list_deleted_folders(self):
        self.given_member_authenticated(["folder.view"])

        response = self.when_list_deleted_folders()

        self.assert_forbidden(response)

    def test_member_with_folder_view_trash_can_list_deleted_folders(self):
        self.given_member_authenticated(["folder.view_trash"])

        response = self.when_list_deleted_folders()

        self.assert_ok(response)
        self.assert_visible_folder_names(response, ["Deleted folder"])


class FolderRestoreRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.deleted_folder = Folder.objects.create(
            project=self.project,
            name="Deleted folder",
        )
        self.deleted_folder.soft_delete(self.owner)
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
    def test_member_without_folder_restore_cannot_restore_folder(self):
        self.given_member_authenticated(["folder.view_trash"])

        response = self.when_restore_folder()

        self.assert_forbidden(response)
        self.assert_folder_still_deleted()

    def test_member_with_folder_restore_can_restore_folder(self):
        self.given_member_authenticated(["folder.restore"])

        response = self.when_restore_folder()

        self.assert_ok(response)
        self.assert_folder_restored()


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

    def test_member_can_get_project_with_membership_only(self):
        self.given_member_authenticated([])

        response = self.when_get_project()

        self.assert_ok(response)

    def test_non_member_cannot_get_project(self):
        self.given_authenticated(self.other_user)

        response = self.when_get_project()

        self.assert_not_found(response)

    # TESTS PATCH
    def test_member_without_project_edit_cannot_patch_project(self):
        self.given_member_authenticated([])

        response = self.when_patch_project_name("Blocked edit")

        self.assert_forbidden(response)
        self.assert_project_name("Main project")
        self.assert_project_not_deleted()

    def test_member_with_project_edit_can_patch_project(self):
        self.given_member_authenticated(["project.edit"])

        response = self.when_patch_project_name("Edited by member")

        self.assert_ok(response)
        self.assert_project_name("Edited by member")
        self.assert_project_not_deleted()

    # TESTS DELETE
    def test_member_without_project_delete_cannot_delete_project(self):
        self.given_member_authenticated(["project.edit"])

        response = self.when_delete_project()

        self.assert_forbidden(response)
        self.assert_project_not_deleted()

    def test_member_with_project_delete_can_soft_delete_project(self):
        self.given_member_authenticated(["project.delete"])

        response = self.when_delete_project()

        self.assert_no_content(response)
        self.assert_project_deleted_by(self.member)


class RoleDetailRoutePermissionTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()

        self.target_role = Role.objects.create(
            project=self.project,
            name="Target role",
        )

        self.url = f"/api/projects/{self.project.id}/roles/{self.target_role.id}/"

    # WHEN
    def when_get_role(self):
        return self.api_get(self.url)

    def when_patch_role_name(self, name):
        return self.api_patch(self.url, {"name": name})

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

    # TESTS GET
    def test_anonymous_cannot_get_role(self):
        response = self.when_get_role()

        self.assert_unauthorized(response)

    def test_member_with_role_view_can_get_role(self):
        self.given_member_authenticated(["role.view"])

        response = self.when_get_role()

        self.assert_ok(response)

    def test_member_without_role_view_cannot_get_role(self):
        self.given_member_authenticated([])

        response = self.when_get_role()

        self.assert_forbidden(response)

    # TESTS PATCH
    def test_member_without_role_edit_cannot_patch_role(self):
        self.given_member_authenticated(["role.view"])

        response = self.when_patch_role_name("Blocked role edit")

        self.assert_forbidden(response)
        self.assert_role_name("Target role")
        self.assert_role_not_deleted()

    def test_member_with_role_edit_can_patch_role(self):
        self.given_member_authenticated(["role.view", "role.edit"])

        response = self.when_patch_role_name("Edited role")

        self.assert_ok(response)
        self.assert_role_name("Edited role")
        self.assert_role_not_deleted()

    # TESTS DELETE
    def test_member_without_role_delete_cannot_delete_role(self):
        self.given_member_authenticated(["role.view", "role.edit"])

        response = self.when_delete_role()

        self.assert_forbidden(response)
        self.assert_role_not_deleted()

    def test_member_with_role_delete_can_soft_delete_role(self):
        self.given_member_authenticated(["role.view", "role.delete"])

        response = self.when_delete_role()

        self.assert_no_content(response)
        self.assert_role_deleted_by(self.member)


class ProjectMemberDetailRoutePermissionTests(ProjectApiTestCase):
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
        self.url = f"/api/projects/{self.project.id}/members/{self.target_member.id}/"

    # WHEN
    def when_delete_member(self):
        return self.api_delete(self.url)

    # ASSERT
    def assert_member_not_deleted(self):
        self.target_member.refresh_from_db()
        self.assertIsNone(self.target_member.deleted_at)

    def assert_member_deleted_by(self, user):
        self.target_member.refresh_from_db()
        self.assertIsNotNone(self.target_member.deleted_at)
        self.assertEqual(self.target_member.deleted_by_id, user.id)

    # TESTS DELETE
    def test_member_without_member_edit_cannot_delete_member(self):
        self.given_member_authenticated(["member.view"])

        response = self.when_delete_member()

        self.assert_forbidden(response)
        self.assert_member_not_deleted()

    def test_member_with_member_edit_can_soft_delete_member(self):
        self.given_member_authenticated(["member.edit"])

        response = self.when_delete_member()

        self.assert_no_content(response)
        self.assert_member_deleted_by(self.member)
