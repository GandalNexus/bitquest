#!/usr/bin/env bash
# init-wallet.sh — Initialise le wallet du container bitquest-lnd (one-time).
#
# LND démarre sans wallet : on doit créer un wallet via `lncli create` avant
# qu'il ne devienne opérationnel (/v1/getinfo renvoie 404 sans wallet). Ce
# script automatise la création avec un password dev (NON production).
#
# Idempotent : si le wallet existe déjà, affiche juste les infos.
#
# Usage (depuis le host) :
#   bash scripts/lnd/init-wallet.sh

set -euo pipefail

CONTAINER="${LND_CONTAINER:-bitquest-lnd}"
WALLET_PASSWORD="${LND_WALLET_PASSWORD:-bitquest-dev-password-insecure}"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Le container ${CONTAINER} n'est pas lancé."
  echo "   Lance d'abord : docker compose -f docker-compose.dev.yml --profile lnd up -d lnd"
  exit 1
fi

# Attend que tls.cert soit généré (lnd démarre et crée le cert avant le wallet).
echo "⏳ Attente de tls.cert..."
for i in $(seq 1 30); do
  if docker exec "${CONTAINER}" test -f /root/.lnd/tls.cert; then
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "❌ tls.cert n'apparaît pas — lnd n'a pas démarré correctement."
    exit 1
  fi
done

# Si le wallet existe déjà, on s'arrête ici.
if docker exec "${CONTAINER}" test -f /root/.lnd/data/chain/bitcoin/testnet/wallet.db; then
  echo "✅ Wallet déjà créé ; nothing to do."
  echo "   Tente : docker exec ${CONTAINER} lncli --network=testnet getinfo"
  exit 0
fi

echo "🔨 Création du wallet via REST /v1/initwallet..."

# Génère un cipher seed vide (LND acceptera avec --noseedbackup).
# On passe par l'API REST car `lncli create` est interactif (stdin TTY).
# Encodage base64 du password pour l'API.
PW_B64=$(printf '%s' "${WALLET_PASSWORD}" | base64 | tr -d '\n')

# Récupère le seed d'abord (API /v1/genseed).
SEED_JSON=$(docker exec "${CONTAINER}" sh -c \
  "wget -q -O - --no-check-certificate --header='Content-Type: application/json' \
   https://localhost:8080/v1/genseed")

# Extrait le cipher_seed_mnemonic en JSON array stringifié.
MNEMONIC=$(printf '%s' "${SEED_JSON}" | docker exec -i "${CONTAINER}" sh -c \
  "cat | sed -n 's/.*\"cipher_seed_mnemonic\":\[\([^]]*\)\].*/[\1]/p'")

if [ -z "${MNEMONIC}" ]; then
  echo "❌ Impossible d'obtenir le cipher_seed_mnemonic depuis /v1/genseed."
  echo "   Réponse brute : ${SEED_JSON}"
  exit 1
fi

# POST /v1/initwallet pour créer le wallet.
INIT_BODY="{\"wallet_password\":\"${PW_B64}\",\"cipher_seed_mnemonic\":${MNEMONIC}}"
INIT_RES=$(docker exec -i "${CONTAINER}" sh -c \
  "wget -q -O - --no-check-certificate --header='Content-Type: application/json' \
   --post-data='${INIT_BODY}' https://localhost:8080/v1/initwallet")

echo "✅ Wallet créé. Réponse initwallet :"
echo "${INIT_RES}"
echo ""
echo "⏳ Attente de admin.macaroon (~5-10 s)..."
for i in $(seq 1 30); do
  if docker exec "${CONTAINER}" test -f /root/.lnd/data/chain/bitcoin/testnet/admin.macaroon; then
    echo "✅ admin.macaroon présent."
    break
  fi
  sleep 1
done

echo ""
echo "➡️  Pour extraire les creds dans ton .env :"
echo "   bash scripts/lnd/extract-creds.sh"
