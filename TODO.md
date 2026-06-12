# TODO

## Email Deliverability

- [ ] Evaluate BIMI later for sender logo display in supported inboxes.
  - Requires DMARC enforcement with `p=quarantine` or `p=reject` and `pct=100`.
  - Requires a BIMI-compatible SVG logo hosted over HTTPS.
  - Gmail generally requires a CMC or VMC certificate.
  - Not needed for the current Resend setup; keep current priority on SPF/DKIM/DMARC basics and stable sending reputation.
