from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class SessionAuthenticationScheme(OpenApiAuthenticationExtension):
    """Declare le cookie de session dans le schema OpenAPI.

    drf-spectacular associe ses extensions a une classe exacte : notre sous-classe
    de `SessionAuthentication` n'est donc pas reconnue par celle fournie en standard.
    """

    target_class = "accounts.authentication.SessionAuthentication"
    name = "cookieAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "cookie",
            "name": settings.SESSION_COOKIE_NAME,
        }
