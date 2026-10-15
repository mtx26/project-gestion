import os
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from .settings import secret_env


class SecretEnvironmentTests(SimpleTestCase):
    def test_reads_value_from_secret_file(self):
        with tempfile.TemporaryDirectory() as directory:
            secret_file = Path(directory) / "secret"
            secret_file.write_text("test-secret\n", encoding="utf-8")

            with patch.dict(os.environ, {"TEST_SECRET_FILE": str(secret_file)}):
                self.assertEqual(secret_env("TEST_SECRET"), "test-secret")

    def test_missing_secret_file_is_reported(self):
        with patch.dict(
            os.environ,
            {"TEST_SECRET_FILE": "/missing/test-secret"},
        ):
            with self.assertRaises(ImproperlyConfigured):
                secret_env("TEST_SECRET")
