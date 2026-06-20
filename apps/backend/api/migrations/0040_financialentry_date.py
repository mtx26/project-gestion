from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0039_timeentry_documents"),
    ]

    operations = [
        migrations.AddField(
            model_name="financialentry",
            name="date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
