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







rend tout les page et element bien responsive, essayle de limte le fait e de faire un coposant mobil et pc mais jsyte fait que les coposant soit bien agancer pour mobile, soit responsive


dans la modal de finance , change un peu la logice pour lier une fincae a un time et pouvori dasn la modal cliquer pour aller dans time sur le time selecitonner


mette le filtre sur mobile dasn un bouton filtre avec une modal comme c'est souvent dasn les ite etc

y'a un probeleme avec les selecter de page dasn setting, tash etc car pas resposnive


si je veux mettre en place les notification fcm, mail et apres autre, que utilise la technologie, la manier de lutilsie et lintegre ? 

et met qand le guery etc les triee aussi etc, je veux que le filitre soi tvriement coté bakcend comme les trie et que tou les trie aussi car y'a la pagination 