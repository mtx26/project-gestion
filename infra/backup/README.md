# Sauvegarde PostgreSQL → Google Drive

Service `backup` (voir `docker-compose.yml`) : dump `pg_dump` compressé toutes les
`BACKUP_INTERVAL_HOURS` heures, envoyé sur Google Drive via `rclone`, avec purge
locale et distante après `BACKUP_RETENTION_DAYS` jours.

## 1. Générer la config rclone (une seule fois, en local)

Sur ta machine (pas sur le serveur) :

```bash
rclone config
```

- `n` (new remote) → nom : `gdrive`
- Storage : `drive` (Google Drive)
- Laisser `client_id` / `client_secret` vides (quota partagé rclone) ou mettre
  les tiens si tu veux ton propre quota API
- `scope` : `1` (accès complet à Drive)
- Laisser le reste par défaut, répondre `n` à "Use auto config?" si tu es sur
  une machine sans navigateur, sinon `y` pour ouvrir le flow OAuth dans le
  navigateur et te connecter avec le compte Google cible
- `n` pour "Configure this as a Shared Drive?" (sauf besoin spécifique)
- Confirmer

Crée ensuite le dossier de destination sur Drive et vérifie l'accès :

```bash
rclone mkdir gdrive:project-gestion-backups
rclone lsd gdrive:
```

## 2. Convertir la config en variable d'environnement

Le fichier généré (`~/.config/rclone/rclone.conf` sous Linux/Mac,
`%APPDATA%\rclone\rclone.conf` sous Windows) doit être encodé en base64 :

```bash
# Linux / Mac
base64 -w0 ~/.config/rclone/rclone.conf

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:APPDATA\rclone\rclone.conf"))
```

Colle le résultat dans la variable `RCLONE_CONFIG_B64` du stack Portainer
(Environment variables de la stack, pas committé dans le repo).

## 3. Variables à définir dans Portainer

| Variable | Exemple | Rôle |
|---|---|---|
| `DB_PASSWORD` | (déjà utilisé par `db`/`backend`) | mot de passe Postgres |
| `RCLONE_CONFIG_B64` | (base64 de l'étape 2) | credentials Google Drive |
| `GDRIVE_REMOTE` | `gdrive:project-gestion-backups` | remote:chemin cible sur Drive |
| `BACKUP_INTERVAL_HOURS` | `24` | fréquence des sauvegardes |
| `BACKUP_RETENTION_DAYS` | `14` | purge locale + distante |

L'image `ghcr.io/mtx26/project-gestion-backup` se build automatiquement (voir
`.github/workflows/build-backup.yml`) dès qu'un push sur `main` touche
`infra/backup/**`. Une fois pushé sur `main`, redéployer le stack Portainer
(`docker compose pull backup && docker compose up -d backup` ou via l'UI) : le
service tourne en continu (dump → upload → purge → sleep).

## Vérifier / restaurer

```bash
# lister les sauvegardes sur Drive
rclone ls gdrive:project-gestion-backups

# télécharger et restaurer
rclone copy gdrive:project-gestion-backups/project_gestion-XXXX.sql.gz .
gunzip -c project_gestion-XXXX.sql.gz | docker exec -i <container_db> psql -U project_gestion -d project_gestion
```

## Notes

- Le token OAuth généré par `rclone config` se rafraîchit automatiquement tant
  que le conteneur a accès réseau ; pas besoin de ré-autoriser périodiquement.
- Pour forcer un backup immédiat sans attendre l'intervalle : `docker exec <container_backup> /usr/local/bin/backup.sh` restera bloqué dans la boucle — utiliser plutôt `docker restart` après avoir mis `BACKUP_INTERVAL_HOURS` bas temporairement, ou exécuter manuellement `pg_dump ... | gzip | rclone rcat ...` dans le conteneur.
