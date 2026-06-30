from django.db import migrations


def seed_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.update_or_create(
        code="member.edit_own_rate",
        defaults={
            "name": "permissions.member.edit_own_rate.name",
            "description": "permissions.member.edit_own_rate.description",
        },
    )
    Permission.objects.update_or_create(
        code="member.edit_rates",
        defaults={
            "name": "permissions.member.edit_rates.name",
            "description": "permissions.member.edit_rates.description",
        },
    )


def remove_permissions(apps, schema_editor):
    Permission = apps.get_model("api", "Permission")
    Permission.objects.filter(
        code__in=["member.edit_own_rate", "member.edit_rates"]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0045_projectmember_hourly_rate"),
    ]

    operations = [
        migrations.RunPython(seed_permissions, remove_permissions),
    ]
