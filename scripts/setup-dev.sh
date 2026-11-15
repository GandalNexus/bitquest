#!/usr/bin/env bash
#
# Bootstrap l'env de développement BitQuest (LOT 54).
# Idempotent — relancer est sûr à tout moment.
#
# Étapes :
#   1. Vérifie que docker + docker compose sont installés.
#   2. Lance docker-compose.dev.yml (postgres + redis + app).
#   3. Attend que postgres soit healthy (jusqu'à 60s).
#   4. Applique les migrations Prisma.
#   5. Seed la base avec le dataset dev (idempotent).
#   6. Lance le smoke test routes.
#
# Usage :
#   ./scripts/setup-dev.sh
#
# Variables d'env optionnelles :
#   SKIP_SEED=1   → ne pas seeder (utile si on veut partir d'une
#                    base vide pour les tests E2E).
#   BASE=<url>    → URL du smoke test (défaut http://localhost:3000).

set -eu

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { printf "${BLUE}▶${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}✓${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}⚠${NC} %s\n" "$*"; }
fail()  { printf "${RED}✗${NC} %s\n" "$*" >&2; exit 1; }

info "1/6 · vérifie docker + docker compose"
command -v docker >/dev/null || fail "docker introuvable — installe Docker Desktop d'abord"
docker compose version >/dev/null 2>&1 \
  || fail "docker compose v2 introuvable — mets Docker à jour"
ok "docker + compose OK"

info "2/6 · lance docker-compose.dev.yml"
if [ -f docker-compose.dev.yml ]; then
  docker compose -f docker-compose.dev.yml up -d
else
  warn "docker-compose.dev.yml absent — fallback docker-compose.yml"
  docker compose up -d
fi
ok "containers démarrés"

info "3/6 · attend postgres healthy (jusqu'à 60s)"
deadline=$(( $(date +%s) + 60 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  if docker exec bitquest-db pg_isready -U bitquest >/dev/null 2>&1; then
    ok "postgres accepte les connexions"
    break
  fi
  sleep 1
done
docker exec bitquest-db pg_isready -U bitquest >/dev/null 2>&1 \
  || fail "postgres toujours pas up après 60s — docker compose logs bitquest-db"

info "4/6 · applique les migrations Prisma"
docker exec bitquest-dev npx prisma migrate deploy
ok "migrations appliquées"

if [ "${SKIP_SEED:-0}" = "1" ]; then
  warn "5/6 · SEED SKIPPED (SKIP_SEED=1)"
else
  info "5/6 · seed idempotent (users, quêtes, badges, académie, ChapterQuest)"
  docker exec bitquest-dev npx tsx prisma/seed.ts
  ok "seed terminé"
fi

info "6/6 · smoke test routes"
if [ -x scripts/smoke-routes.sh ]; then
  BASE="${BASE:-http://localhost:3000}" ./scripts/smoke-routes.sh \
    && ok "smoke 22/22 PASS" \
    || warn "smoke a échoué — vérifie que l'app est bien up sur ${BASE:-http://localhost:3000}"
else
  warn "scripts/smoke-routes.sh introuvable — smoke sauté"
fi

echo ""
ok "Setup dev complet."
echo ""
echo "  App       : http://localhost:3000"
echo "  Postgres  : docker exec -it bitquest-db psql -U bitquest"
echo "  Redis     : docker exec -it bitquest-redis redis-cli"
echo "  Tests     : docker exec bitquest-dev npx vitest run"
echo "  E2E       : docker exec bitquest-dev npx playwright test tests/e2e/"
echo ""
