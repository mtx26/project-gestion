from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from .models import Document, Folder, Permission, Project, ProjectMember, Role, RolePermission, Task
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

    # WHEN
    def when_list_permissions(self):
        return self.api_get(self.url)

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
        self.assert_visible_permission_codes(response, ["project.edit", "file.view"])


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
    def when_list_projects(self):
        return self.api_get(self.url)

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

    def test_user_can_list_owned_projects_only_when_not_a_member_elsewhere(self):
        self.given_authenticated(self.other_user)

        response = self.when_list_projects()

        self.assert_ok(response)
        self.assert_visible_project_names(response, ["Other project"])

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


    def test_member_with_project_restore_can_restore_project(self):
        self.given_member_with_permissions(["project.restore"], project=self.deleted_project)
        self.given_authenticated(self.member)

        response = self.when_restore_project()

        self.assert_ok(response)
        self.assert_project_restored()

    def test_member_without_project_restore_cannot_restore_project(self):
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
        self.url = f"/api/projects/{self.other_project.id}/folders/{self.other_project_folder.id}"

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

    def test_member_with_folder_view_can_list_deleted_folders(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_list_deleted_folders()

        self.assert_ok(response)
        self.assert_visible_folder_names(response, ["Deleted folder"])

    def test_member_without_folder_view_cannot_list_deleted_folders(self):
        self.given_member_authenticated([])

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
    def when_list_documents(self, url=None):
        return self.api_get(url or self.url)

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

    def test_member_with_document_view_can_list_deleted_documents(self):
        self.given_member_authenticated(["file.view"])

        response = self.when_list_deleted_documents()

        self.assert_ok(response)
        self.assert_visible_document_names(response, ["Deleted document"])


    def test_member_without_document_view_cannot_list_deleted_documents(self):
        self.given_member_authenticated([])

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

    def test_patch_rejects_assignee_outside_project(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_task({"assigned_to": [self.other_user.id]})

        self.assert_bad_request(response)
        self.task.refresh_from_db()
        self.assertEqual(self.task.assigned_to.count(), 0)

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

    def test_member_with_task_view_can_list_deleted_tasks(self):
        self.given_member_authenticated(["task.view"])

        response = self.when_list_deleted_tasks()

        self.assert_ok(response)
        self.assert_visible_task_titles(response, ["Deleted task"])

    def test_member_without_task_view_cannot_list_deleted_tasks(self):
        self.given_member_authenticated([])

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

    def test_member_with_project_delete_can_soft_delete_project(self):
        self.given_member_authenticated(["project.delete"])

        response = self.when_delete_project()

        self.assert_no_content(response)
        self.assert_project_deleted_by(self.member)

    def test_member_without_project_delete_cannot_delete_project(self):
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
    def when_list_roles(self, url=None):
        return self.api_get(url or self.url)

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
        self.assert_role_permission_codes(["file.edit"])

    def test_patch_role_replaces_permissions(self):
        self.given_authenticated(self.owner)

        response = self.when_patch_role({
            "permission_ids": [self.other_permission.id],
        })

        self.assert_ok(response)
        self.assert_role_permission_codes(["file.edit"])

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

    def test_member_with_role_view_can_list_deleted_roles(self):
        self.given_member_authenticated(["role.view"])

        response = self.when_list_deleted_roles()

        self.assert_ok(response)
        self.assert_visible_role_names(response, ["Deleted role"])


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
    def when_list_members(self, url=None):
        return self.api_get(url or self.url)

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
        self.assert_visible_member_user_ids(response, [self.other_user.id])

    def test_member_with_member_view_can_list_members(self):
        self.given_member_authenticated(["member.view"])

        response = self.when_list_members()

        self.assert_ok(response)
        self.assert_visible_member_user_ids(response, [self.member.id, self.other_user.id])

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
    def test_anonymous_cannot_delete_member(self):
        response = self.when_delete_member()

        self.assert_unauthorized(response)
        self.assert_member_not_deleted()

    def test_owner_can_soft_delete_member(self):
        self.given_authenticated(self.owner)

        response = self.when_delete_member()

        self.assert_no_content(response)
        self.assert_member_deleted_by(self.owner)

    def test_member_with_member_delete_can_soft_delete_member(self):
        self.given_member_authenticated(["member.delete"])

        response = self.when_delete_member()

        self.assert_no_content(response)
        self.assert_member_deleted_by(self.member)

    def test_member_without_member_delete_cannot_delete_member(self):
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
        self.given_member_authenticated(["member.delete"])
        self.url = f"/api/projects/{self.other_project.id}/members/{self.other_project_member.id}/"

        response = self.when_delete_member()

        self.assert_forbidden(response)
        self.other_project_member.refresh_from_db()
        self.assertIsNone(self.other_project_member.deleted_at)
