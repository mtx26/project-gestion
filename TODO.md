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
ok retire le truc du douple clic dans la page projet mais met jsyte un page sur la droite de l'arboresence comme le previsualisetio windows et la tu met les task et temps
permet de chnager de mois etc quand les time settend sur plus , pour povroi les voir dans le claendrier, ok inverse de gauche a droite  les state et entre de temps, et si en mode cledrier, tu cache les state
ok permet d'ouvrir les tache dans une modal, et pour les ficheir ouvre les dans un visualisateur dans une moadal, de manier integre plsutot quand dasn uen autre page, 
simplie build_folder_tree car c'est inconprehensible comme focntion reduit le nombre de focntio et ameliore la lisibilité etc 
permet de trier en clicant dur Tache	Dossier	Statut	Priorite	Echeance

 -->