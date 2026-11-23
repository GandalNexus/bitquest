#!/usr/bin/env bash
#
# backup-postgres.sh — Dump Postgres compressé horodaté + rotation.
#
# Usage :
#   scripts/backup-postgres.sh              # dump via docker exec bitquest-db
#   DATABASE_URL=... scripts/backup-postgres.sh  # dump via psql côté host
#   RETENTION=14 scripts/backup-postgres.sh # garder 14 derniers backups (default 7)
#
# Conventions :
#   - Dump au format custom (pg_dump -Fc), compatible pg_restore.
#   - Fichier produit : backups/bitquest-<timestamp>.dump.gz
#   - Rotation sur `RETENTION` (default 7) — supprime les plus anciens.
#
# Prérequis :
#   - Soit le container docker `bitquest-db` tourne (default).
#   - Soit `pg_dump` est installé côté host et `DATABASE_URL` pointe vers la DB.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION="${RETENTION:-7}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/bitquest-${TIMESTAMP}.dump.gz"

mkdir -p "${BACKUP_DIR}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "→ pg_dump via host (DATABASE_URL fourni)"
  pg_dump --format=custom --no-owner --no-acl "${DATABASE_URL}" | gzip -9 > "${BACKUP_FILE}"
else
  CONTAINER="${PG_CONTAINER:-bitquest-db}"
  DB_USER="${PG_USER:-bitquest}"
  DB_NAME="${PG_DB:-bitquest}"
  echo "→ pg_dump via docker exec ${CONTAINER}"
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "❌ Container '${CONTAINER}' introuvable. Lance 'docker compose up -d postgres' ou définis DATABASE_URL." >&2
    exit 1
  fi
  docker exec -i "${CONTAINER}" pg_dump \
    --format=custom --no-owner --no-acl \
    -U "${DB_USER}" "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"
fi

SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "✅ Backup : ${BACKUP_FILE} (${SIZE})"

# Rotation : garder les N backups les plus récents.
if [[ "${RETENTION}" -gt 0 ]]; then
  ALL="$(ls -1t "${BACKUP_DIR}"/bitquest-*.dump.gz 2>/dev/null || true)"
  COUNT="$(printf '%s\n' "${ALL}" | grep -c . || true)"
  if [[ "${COUNT}" -gt "${RETENTION}" ]]; then
    TO_DELETE="$(printf '%s\n' "${ALL}" | tail -n +$((RETENTION + 1)))"
    echo "→ Rotation : suppression de $(printf '%s\n' "${TO_DELETE}" | wc -l | tr -d ' ') backup(s) au-delà de ${RETENTION}"
    printf '%s\n' "${TO_DELETE}" | xargs -r rm -f
  fi
fi
