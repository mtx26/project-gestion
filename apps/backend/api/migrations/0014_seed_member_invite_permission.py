from django.db import migrations


PERMISSION = {
    "code": "member.invite",
    "name": "permissions.member.invite.name",
    "description": "permissions.member.invite.description",
}


def seed_member_invite_permission(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.update_or_create(
        code=PERMISSION["code"],
        defaults={
            "name": PERMISSION["name"],
            "description": PERMISSION["description"],
        },
    )


def remove_member_invite_permission(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(code=PERMISSION["code"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0013_invitation_unique_active_pending_invitation"),
    ]

    operations = [
        migrations.RunPython(
            seed_member_invite_permission,
            remove_member_invite_permission,
        ),
    ]
