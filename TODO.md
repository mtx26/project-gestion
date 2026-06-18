# TODO

## Email Deliverability

- [ ] Evaluate BIMI later for sender logo display in supported inboxes.
  - Requires DMARC enforcement with `p=quarantine` or `p=reject` and `pct=100`.
  - Requires a BIMI-compatible SVG logo hosted over HTTPS.
  - Gmail generally requires a CMC or VMC certificate.
  - Not needed for the current Resend setup; keep current priority on SPF/DKIM/DMARC basics and stable sending reputation.

  rajoute materiaux a achter

## Product Ideas

- [ ] Analyze uploaded invoices/receipts with AI to prefill financial entries.
  - Extract amount, date, supplier, document type, suggested category, and project/folder suggestion.
  - Let the user review and confirm before creating or updating a `FinancialEntry`.
  - Keep the original document linked as the archive/proof.


    faire un chat par projet

<!-- 
non range les filtre de achs, temps, financez et reboursment , il dois etre aligner et coerent
arrage partout au member liste est utilise pour bien afficher dasn parametre que c'est l proprio et qu'on puisse pas modif le role etc , 
affiche aussi le pp dan la liste des mebre et dans poarametre
retire Paiement temps #8 ca ajoute rien du tout 
juste met pour qui c'etais Depense
-20,00 €
Main d'oeuvre
Paiement temps #8 a qui on paye plus tot 

ne met pas deux truc different :     document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True)
    documents = models.ManyToManyField(
        Document,
        blank=True,
        related_name="financial_entries_docs",
    )
retire kle fait de un doc, jsute c'est juste un list de 1 id
met des reset de filtre dasn totute les page ou y'a un filitre, ensuit ele drad en drop de dossier est pas tre beau et aussi on peut le mettr dasn ces enfatn ca met une erreur, fait comme dans windows ou ca bloque sans essayer et retire lez cardre vert moche
enusite les modal pour finacee et rboursemnret ne amrche pas quand on lci dessus
 

 -->