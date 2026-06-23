from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0041_set_null_on_user_fks"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
