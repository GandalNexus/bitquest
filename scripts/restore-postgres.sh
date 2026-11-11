#!/usr/bin/env bash
#
# restore-postgres.sh — Restaure un dump Postgres .dump.gz.
#
# Usage :
#   scripts/restore-postgres.sh backups/bitquest-20261111T130000Z.dump.gz
#
# Prérequis :
#   - Soit le container docker `bitquest-db` tourne (default).
#   - Soit `pg_restore` est installé côté host et `DATABASE_URL` pointe vers la DB.
#
# ⚠️  Ce script DROP et recrée les objets (clean=true, if-exists=true).
#     Exige une confirmation interactive sauf si `FORCE=1` est défini.

set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "Usage: $0 <backup.dump.gz>" >&2
  exit 2
fi

BACKUP_FILE="$1"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "❌ Fichier introuvable : ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ "${FORCE:-0}" != "1" ]]; then
  echo "⚠️  Restauration depuis ${BACKUP_FILE}"
  echo "    Cela va DROP les tables existantes dans la DB cible."
  read -r -p "    Tape 'yes' pour continuer : " CONFIRM
  if [[ "${CONFIRM}" != "yes" ]]; then
    echo "Abandon." >&2
    exit 1
  fi
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "→ pg_restore via host (DATABASE_URL fourni)"
  gunzip -c "${BACKUP_FILE}" | pg_restore \
    --clean --if-exists --no-owner --no-acl \
    --dbname="${DATABASE_URL}"
else
  CONTAINER="${PG_CONTAINER:-bitquest-db}"
  DB_USER="${PG_USER:-bitquest}"
  DB_NAME="${PG_DB:-bitquest}"
  echo "→ pg_restore via docker exec ${CONTAINER}"
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "❌ Container '${CONTAINER}' introuvable." >&2
    exit 1
  fi
  gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER}" pg_restore \
    --clean --if-exists --no-owner --no-acl \
    -U "${DB_USER}" -d "${DB_NAME}"
fi

echo "✅ Restore terminé."
