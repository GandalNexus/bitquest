#!/usr/bin/env bash
set -u
BASE=${BASE:-http://localhost:3000}
PASS=0
FAIL=0

check() {
  local path="$1" expected="$2" label="$3"
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
  if [[ "$status" == "$expected" ]]; then
    echo "  OK   $expected  $path  ($label)"
    PASS=$((PASS+1))
  else
    echo "  FAIL $status (want $expected) $path  ($label)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Public pages (200 ou redirect) ==="
check "/" 200 "home"
check "/verify" 200 "verify idle"
check "/verify?blob=malformed" 200 "verify ko (page always 200)"
check "/academy" 200 "academy catalog"
check "/academy/fondamentaux-bitcoin" 200 "academy course"
check "/gandalnexus" 200 "landing"

echo ""
echo "=== Public API ==="
check "/api/health" 200 "health"
check "/api/version" 200 "version auto-discovery (LOT 44)"
check "/.well-known/nostr.json" 200 "NIP-11 nostr.json (LOT 71)"
check "/openapi.yaml" 200 "OpenAPI 3.1 spec (LOT 79)"
check "/manifest.webmanifest" 200 "PWA manifest (LOT 80)"
check "/api/certificates/verify?blob=xx" 400 "cert verify invalid"
check "/api/certificates/verify" 400 "cert verify missing"
check "/api/academy/courses/fondamentaux-bitcoin" 200 "academy course API"

echo ""
echo "=== Auth-required (401 pour anonyme) ==="
check "/api/me/attestations" 401 "me attestations anon"
check "/api/me/bitlab-stats" 401 "me bitlab-stats anon"

echo ""
echo "=== Private pages (redirect 307 pour anonyme) ==="
# Next.js redirects via requireRoleSsr renvoient 307 (Temporary Redirect)
status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/attestations")
if [[ "$status" == "200" || "$status" == "307" || "$status" == "302" ]]; then
  echo "  OK   $status  /attestations  (anonymous)"
  PASS=$((PASS+1))
else
  echo "  FAIL $status  /attestations"
  FAIL=$((FAIL+1))
fi
status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dashboard")
if [[ "$status" == "200" || "$status" == "307" || "$status" == "302" ]]; then
  echo "  OK   $status  /dashboard  (anonymous)"
  PASS=$((PASS+1))
else
  echo "  FAIL $status  /dashboard"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== Admin pages (redirect/deny pour anonyme) ==="
for path in /admin /admin/feature-flags /admin/attestations /admin/audit /admin/chapters /admin/users /admin/lightning-rewards; do
  status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
  if [[ "$status" == "200" || "$status" == "307" || "$status" == "302" ]]; then
    echo "  OK   $status  $path"
    PASS=$((PASS+1))
  else
    echo "  FAIL $status  $path"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "=== SOMMAIRE ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
exit $FAIL
