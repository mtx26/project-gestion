from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Bridges Django's validation vocabulary (`Model.clean()`/`full_clean()`,
    and business-rule `ValidationError`s raised directly from services) into DRF's
    error responses.

    Without this, every serializer that needs to trigger `full_clean()` or call a
    service raising `django.core.exceptions.ValidationError` would have to catch it
    and translate it by hand — DRF's default handler only understands its own
    `rest_framework.exceptions.APIException` family.
    """
    if isinstance(exc, DjangoValidationError):
        detail = exc.message_dict if hasattr(exc, "message_dict") else exc.messages
        exc = serializers.ValidationError(detail)

    return drf_exception_handler(exc, context)
