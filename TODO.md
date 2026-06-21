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






fait un audit de tout les composant etc pour limiter la duplication, je evux vriement que totu les logique els meme soit ressembler dasn un composant






rend tout les page et element bien responsive, essayle de limte le fait e de faire un coposant mobil et pc mais jsyte fait que les coposant soit bien agancer pour mobile, soit responsive


dans la modal de finance , change un peu la logice pour lier une fincae a un time et pouvori dasn la modal cliquer pour aller dans time sur le time selecitonner