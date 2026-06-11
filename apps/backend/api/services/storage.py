import uuid
from pathlib import PurePosixPath
from urllib.parse import quote

import boto3
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from rest_framework.exceptions import ValidationError


def get_s3_client():
    missing_settings = [
        name
        for name in [
            "S3_ENDPOINT_URL",
            "S3_ACCESS_KEY_ID",
            "S3_SECRET_ACCESS_KEY",
            "S3_BUCKET_NAME",
        ]
        if not getattr(settings, name, None)
    ]

    if missing_settings:
        raise ImproperlyConfigured(
            f"Missing S3 settings: {', '.join(missing_settings)}"
        )

    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        region_name=settings.S3_REGION,
    )


def build_document_file_id(file_name, project_id):
    safe_file_name = PurePosixPath(file_name).name
    return f"projects/{project_id}/documents/{uuid.uuid4()}-{safe_file_name}"


def build_profile_picture_file_id(file_name, user_id):
    safe_file_name = PurePosixPath(file_name).name
    return f"users/{user_id}/profile-pictures/{uuid.uuid4()}-{safe_file_name}"


def build_s3_object_url(file_id, bucket_name=None):
    endpoint_url = settings.S3_ENDPOINT_URL.rstrip("/")
    quoted_file_id = quote(file_id, safe="/")
    return f"{endpoint_url}/{bucket_name or settings.S3_BUCKET_NAME}/{quoted_file_id}"


def validate_document_file(file):
    file_name = PurePosixPath(file.name).name
    extension = PurePosixPath(file_name).suffix.lower()
    file_size = getattr(file, "size", None)
    content_type = (getattr(file, "content_type", None) or "").lower()

    if file_size is not None and file_size > settings.DOCUMENT_MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError({
            "file": ["errors.document.file_too_large"],
        })

    if extension not in settings.DOCUMENT_ALLOWED_FILE_EXTENSIONS:
        raise ValidationError({
            "file": ["errors.document.file_type_not_allowed"],
        })

    allowed_mime_types = settings.DOCUMENT_ALLOWED_MIME_TYPES
    fallback_mime_types = settings.DOCUMENT_FALLBACK_MIME_TYPES
    if content_type and content_type not in allowed_mime_types | fallback_mime_types:
        raise ValidationError({
            "file": ["errors.document.file_type_not_allowed"],
        })


def validate_profile_picture_file(file):
    file_name = PurePosixPath(file.name).name
    extension = PurePosixPath(file_name).suffix.lower()
    file_size = getattr(file, "size", None)
    content_type = (getattr(file, "content_type", None) or "").lower()

    if file_size is not None and file_size > settings.PROFILE_PICTURE_MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError({
            "file": ["errors.profile_picture.file_too_large"],
        })

    if extension not in settings.PROFILE_PICTURE_ALLOWED_FILE_EXTENSIONS:
        raise ValidationError({
            "file": ["errors.profile_picture.file_type_not_allowed"],
        })

    if content_type and content_type not in settings.PROFILE_PICTURE_ALLOWED_MIME_TYPES:
        raise ValidationError({
            "file": ["errors.profile_picture.file_type_not_allowed"],
        })


def upload_document_file(file, project_id):
    validate_document_file(file)

    file_id = build_document_file_id(file.name, project_id)
    content_type = getattr(file, "content_type", None) or "application/octet-stream"

    get_s3_client().upload_fileobj(
        file,
        settings.S3_BUCKET_NAME,
        file_id,
        ExtraArgs={
            "ContentType": content_type,
        },
    )

    return {
        "file_id": file_id,
        "file_name": PurePosixPath(file.name).name,
        "file_size": getattr(file, "size", None),
        "mime_type": content_type,
    }


def upload_profile_picture_file(file, user_id):
    validate_profile_picture_file(file)

    file_id = build_profile_picture_file_id(file.name, user_id)
    content_type = getattr(file, "content_type", None) or "application/octet-stream"
    bucket_name = settings.PROFILE_PICTURE_S3_BUCKET_NAME

    get_s3_client().upload_fileobj(
        file,
        bucket_name,
        file_id,
        ExtraArgs={
            "ContentType": content_type,
        },
    )

    return {
        "file_id": file_id,
        "url": build_s3_object_url(file_id, bucket_name),
    }


def get_document_file(file_id):
    return get_s3_client().get_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=file_id,
    )


def delete_document_file(file_id):
    get_s3_client().delete_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=file_id,
    )


def get_document_download_url(file_id, expires_in=None):
    return get_s3_client().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": file_id,
        },
        ExpiresIn=expires_in or settings.S3_PRESIGNED_URL_EXPIRES_SECONDS,
    )
