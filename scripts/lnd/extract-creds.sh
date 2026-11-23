#!/usr/bin/env bash
# extract-creds.sh — Extrait macaroon + tls.cert du container bitquest-lnd
# et les affiche au format attendu dans .env.
#
# À utiliser une fois que le wallet a été initialisé (voir init-wallet.sh).
# L'output est copiable tel quel dans .env ou .env.local du projet.
#
# Pour une URL d'accès depuis bitquest-dev (réseau Docker), on utilise le
# hostname du container ; depuis l'hôte, utiliser localhost.

set -euo pipefail

CONTAINER="${LND_CONTAINER:-bitquest-lnd}"
MACAROON_PATH="${LND_MACAROON_PATH:-/root/.lnd/data/chain/bitcoin/testnet/readonly.macaroon}"
TLS_PATH="${LND_TLS_PATH:-/root/.lnd/tls.cert}"
LND_HOSTNAME="${LND_HOSTNAME:-bitquest-lnd}"
LND_PORT="${LND_PORT:-8080}"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Le container ${CONTAINER} n'est pas lancé." >&2
  exit 1
fi

if ! docker exec "${CONTAINER}" test -f "${MACAROON_PATH}"; then
  echo "❌ Macaroon absent : ${MACAROON_PATH}" >&2
  echo "   Le wallet n'a pas encore été initialisé. Lance scripts/lnd/init-wallet.sh." >&2
  exit 1
fi

MACAROON_HEX=$(docker exec "${CONTAINER}" xxd -p -c 1000 "${MACAROON_PATH}" | tr -d '\n')
TLS_B64=$(docker exec "${CONTAINER}" base64 -w 0 "${TLS_PATH}" 2>/dev/null || \
  docker exec "${CONTAINER}" base64 "${TLS_PATH}" | tr -d '\n')

cat <<EOF
# --- LND credentials (générés $(date -u +%Y-%m-%dT%H:%M:%SZ)) ---
# À coller dans .env ou .env.local du projet BitQuest.
LND_REST_URL=https://${LND_HOSTNAME}:${LND_PORT}
LND_MACAROON_HEX=${MACAROON_HEX}
LND_TLS_CERT_B64=${TLS_B64}
# ------------------------------------------------------------------
EOF
