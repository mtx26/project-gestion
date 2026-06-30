from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0047_projectownerrate"),
    ]

    operations = [
        migrations.RenameField(
            model_name="task",
            old_name="due_date",
            new_name="end_date",
        ),
    ]
