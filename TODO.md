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
et dans project avec l'arboerance met aussi par qui c'est creer mais dnas l'Apercu du dossier , 
rajhoite tou les truc en plus dans le clic droit dans projet et retire tou les ajouter, mais juste le view qui redireige vers la page avec lke fitltre 
change Totaux - toute l'equipe - ce mois - tous statuts - Technique poru qui soit dan le mem ordre que le filtre
met un filtre pour reboursement  et finance et task un filtre par user.
 

 -->