# Resend templates

Fichiers HTML a copier dans Resend.

- `email_verification.html`
  - Variables HTML: `{{{USER_NAME}}}`, `{{{VERIFY_URL}}}`
  - Env: `RESEND_EMAIL_VERIFICATION_TEMPLATE_ID`
  - From: `Project Gestion <no-reply@your-domain.com>`
  - Subject: `Verification de votre adresse email`
- `password_reset.html`
  - Variables HTML: `{{{USER_NAME}}}`, `{{{RESET_URL}}}`
  - Env: `RESEND_PASSWORD_RESET_TEMPLATE_ID`
  - From: `Project Gestion <no-reply@your-domain.com>`
  - Subject: `Reinitialisation de votre mot de passe`
- `project_invitation.html`
  - Variables HTML: `{{{PROJECT_NAME}}}`, `{{{INVITER_NAME}}}`, `{{{INVITATION_URL}}}`, `{{{EXPIRES_AT}}}`
  - Env: `RESEND_INVITATION_TEMPLATE_ID`
  - From: `Project Gestion <no-reply@your-domain.com>`
  - Subject: `Invitation au projet`

Dans Resend, `From` est un champ du template ou de l'envoi, pas une balise HTML.
En backend, la valeur envoyee vient de `DEFAULT_FROM_EMAIL`.
Dans le HTML Resend, les variables doivent utiliser trois accolades: `{{{VARIABLE_NAME}}}`.
Les preview texts sont inclus dans chaque HTML via un preheader cache.

## Sync automatique

Depuis la racine du repo:

```powershell
python .\scripts\sync_resend_templates.py
```

Le script lit automatiquement `.env`, puis `.env.local`.
`.env.local` remplace `.env` si la meme variable existe.
Au lancement, il affiche la source de la cle Resend avec une valeur masquee.

Le script cree ou met a jour les templates par alias, puis les publie.
