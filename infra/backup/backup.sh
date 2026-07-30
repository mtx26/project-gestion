#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/backups
RCLONE_CONF=/config/rclone/rclone.conf
INTERVAL_SECONDS=$(( ${BACKUP_INTERVAL_HOURS:-24} * 3600 ))
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}

mkdir -p "$BACKUP_DIR" "$(dirname "$RCLONE_CONF")"

if [ -n "${RCLONE_CONFIG_B64:-}" ]; then
  echo "$RCLONE_CONFIG_B64" | base64 -d > "$RCLONE_CONF"
fi

if [ ! -s "$RCLONE_CONF" ]; then
  echo "[backup] ERROR: $RCLONE_CONF is missing or empty. Set RCLONE_CONFIG_B64." >&2
  exit 1
fi

run_backup() {
  local ts file
  ts=$(date +%Y%m%d-%H%M%S)
  file="$BACKUP_DIR/project_gestion-$ts.sql.gz"

  echo "[backup] $(date -Iseconds) Dumping database..."
  pg_dump | gzip > "$file"

  echo "[backup] Uploading to $GDRIVE_REMOTE..."
  rclone copy "$file" "$GDRIVE_REMOTE" --config "$RCLONE_CONF"

  echo "[backup] Pruning local backups older than ${RETENTION_DAYS}d..."
  find "$BACKUP_DIR" -name '*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

  echo "[backup] Pruning remote backups older than ${RETENTION_DAYS}d..."
  rclone delete "$GDRIVE_REMOTE" --min-age "${RETENTION_DAYS}d" --config "$RCLONE_CONF"

  echo "[backup] Done."
}

while true; do
  run_backup || echo "[backup] FAILED at $(date -Iseconds)" >&2
  sleep "$INTERVAL_SECONDS"
done
