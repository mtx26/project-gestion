#!/usr/bin/env python
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ROOT_DIR = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = ROOT_DIR / "resend_templates"
API_BASE_URL = "https://api.resend.com"


def variable(key, type_, fallback):
    return {
        "key": key,
        "type": type_,
        "fallbackValue": fallback,
        "fallback_value": fallback,
    }


TEMPLATES = [
    {
        "name": "Email verification",
        "alias": "email-verification",
        "subject": "Verification de votre adresse email",
        "html_file": "email_verification.html",
        "variables": [
            variable("USER_NAME", "string", "utilisateur"),
            variable("VERIFY_URL", "string", "https://example.com"),
        ],
    },
    {
        "name": "Password reset",
        "alias": "password-reset",
        "subject": "Reinitialisation de votre mot de passe",
        "html_file": "password_reset.html",
        "variables": [
            variable("USER_NAME", "string", "utilisateur"),
            variable("RESET_URL", "string", "https://example.com"),
        ],
    },
    {
        "name": "Project invitation",
        "alias": "project-invitation",
        "subject": "Invitation au projet",
        "html_file": "project_invitation.html",
        "variables": [
            variable("PROJECT_NAME", "string", "Projet"),
            variable("INVITER_NAME", "string", "Un membre"),
            variable("INVITATION_URL", "string", "https://example.com"),
            variable("EXPIRES_AT", "string", "prochainement"),
        ],
    },
    {
        "name": "Invitation accepted",
        "alias": "invitation-accepted",
        "subject": "Invitation acceptée",
        "html_file": "invitation_accepted.html",
        "variables": [
            variable("INVITEE_NAME", "string", "Un membre"),
            variable("PROJECT_NAME", "string", "Projet"),
            variable("PROJECT_URL", "string", "https://example.com"),
        ],
    },
]


def main():
    env_sources = {}
    load_env_files(ROOT_DIR / ".env", ROOT_DIR / ".env.local", sources=env_sources)

    api_key = os.environ.get("RESEND_API_KEY")
    from_email = os.environ.get("DEFAULT_FROM_EMAIL")

    if not api_key:
        fail("RESEND_API_KEY is required.")

    if not from_email:
        fail("DEFAULT_FROM_EMAIL is required, e.g. Project Gestion <no-reply@example.com>.")

    print(
        "Using RESEND_API_KEY "
        f"{mask_secret(api_key)} from {env_sources.get('RESEND_API_KEY', 'process env')}"
    )
    print(
        "Using DEFAULT_FROM_EMAIL "
        f"{from_email} from {env_sources.get('DEFAULT_FROM_EMAIL', 'process env')}"
    )

    existing_templates = list_templates(api_key)
    existing_by_alias = {
        template.get("alias"): template
        for template in existing_templates
        if template.get("alias")
    }

    for template in TEMPLATES:
        payload = build_payload(template, from_email)
        existing = existing_by_alias.get(template["alias"])

        if existing:
            template_id = existing["id"]
            request_json(api_key, "PATCH", f"/templates/{template_id}", payload)
            action = "updated"
        else:
            created = request_json(api_key, "POST", "/templates", payload)
            template_id = created["id"]
            action = "created"

        request_json(api_key, "POST", f"/templates/{template_id}/publish")
        print(f"{action} and published {template['alias']} ({template_id})")


def build_payload(template, from_email):
    html_path = TEMPLATES_DIR / template["html_file"]
    if not html_path.exists():
        fail(f"Missing template file: {html_path}")

    return {
        "name": template["name"],
        "alias": template["alias"],
        "from": from_email,
        "subject": template["subject"],
        "html": html_path.read_text(encoding="utf-8"),
        "variables": template["variables"],
    }


def load_env_files(*paths, sources=None):
    sources = sources if sources is not None else {}

    for path in paths:
        if not path.exists():
            continue

        for line in path.read_text(encoding="utf-8").splitlines():
            key, value = parse_env_line(line)
            if key:
                os.environ[key] = value
                sources[key] = str(path)


def parse_env_line(line):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        return None, None

    key, value = line.split("=", 1)
    key = key.strip()
    value = value.strip()

    if not key:
        return None, None

    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]

    return key, value


def mask_secret(value):
    if len(value) <= 8:
        return "***"
    return f"{value[:6]}...{value[-4:]}"


def list_templates(api_key):
    response = request_json(api_key, "GET", "/templates")
    if isinstance(response, list):
        return response
    return response.get("data", [])


def request_json(api_key, method, path, payload=None):
    body = None
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "project-gestion-resend-template-sync/1.0",
    }

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    request = Request(
        f"{API_BASE_URL}{path}",
        data=body,
        headers=headers,
        method=method,
    )

    try:
        with urlopen(request, timeout=30) as response:
            content = response.read().decode("utf-8")
    except HTTPError as error:
        error_body = error.read().decode("utf-8")
        fail(f"Resend API error {error.code} on {method} {path}: {error_body}")

    if not content:
        return {}

    return json.loads(content)


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    main()
