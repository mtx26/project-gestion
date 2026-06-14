from django.db import migrations


DEMO_TREE = [
    {
        "name": "Administration",
        "children": [
            {
                "name": "Contrats",
                "documents": [
                    ("Contrat client", "contrat-client.pdf", "application/pdf", 245_760),
                    ("Avenant 2024", "avenant-2024.pdf", "application/pdf", 98_304),
                ],
            },
            {
                "name": "Factures",
                "documents": [
                    ("Facture mars", "facture-mars.pdf", "application/pdf", 54_272),
                ],
            },
        ],
    },
    {
        "name": "Technique",
        "children": [
            {
                "name": "Plans",
                "documents": [
                    ("Plan etage RDC", "plan-etage-rdc.pdf", "application/pdf", 1_048_576),
                    ("Plan coupe", "plan-coupe.pdf", "application/pdf", 876_544),
                ],
            },
            {
                "name": "Notes",
                "documents": [
                    ("Compte-rendu chantier", "compte-rendu-chantier.txt", "text/plain", 4_096),
                ],
            },
        ],
    },
    {
        "name": "Photos",
        "documents": [
            ("Chantier juin", "chantier-juin.jpg", "image/jpeg", 2_621_440),
        ],
    },
]


def seed_project_3_demo_files(apps, schema_editor):
    Project = apps.get_model("api", "Project")
    Folder = apps.get_model("api", "Folder")
    Document = apps.get_model("api", "Document")

    if not Project.objects.filter(pk=3).exists():
        return

    project = Project.objects.get(pk=3)
    file_counter = 1

    def create_folder(name, parent=None):
        return Folder.objects.create(
            project=project,
            parent_folder=parent,
            name=name,
        )

    def create_document(name, file_name, mime_type, file_size, folder):
        nonlocal file_counter
        document = Document.objects.create(
            project=project,
            folder=folder,
            name=name,
            file_id=f"seed-project-3-doc-{file_counter:03d}",
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
        )
        file_counter += 1
        return document

    def seed_node(node, parent_folder=None):
        folder = create_folder(node["name"], parent_folder)

        for child in node.get("children", []):
            seed_node(child, folder)

        for document in node.get("documents", []):
            create_document(*document, folder)

    for root in DEMO_TREE:
        seed_node(root)


def remove_project_3_demo_files(apps, schema_editor):
    Project = apps.get_model("api", "Project")
    Folder = apps.get_model("api", "Folder")
    Document = apps.get_model("api", "Document")

    if not Project.objects.filter(pk=3).exists():
        return

    Document.objects.filter(project_id=3, file_id__startswith="seed-project-3-doc-").delete()
    Folder.objects.filter(
        project_id=3,
        name__in=["Administration", "Technique", "Photos"],
        parent_folder__isnull=True,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0024_seed_active_permissions"),
    ]

    operations = [
        migrations.RunPython(
            seed_project_3_demo_files,
            remove_project_3_demo_files,
        ),
    ]
