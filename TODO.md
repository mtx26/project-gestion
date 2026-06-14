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
essayer de un peu plus separe par section ect en composant reutilise etc pour simplifier la logic, essaye vraiment d'avoir une bonne oraganisation depusi le debut pour que ca soit reutilise facilement etc , la vue actuelle eets pas bien, info iinutil etc, je evux dans le cound de la bar pourvori seletion le projet ou ajoute dans la liste etc diremenct, retire totu ce qui est en lien avec d'autre projet dans le dahborad, ameliore