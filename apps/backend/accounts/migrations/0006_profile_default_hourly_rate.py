from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_remove_document_unique_document_name_per_folder_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="default_hourly_rate",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
