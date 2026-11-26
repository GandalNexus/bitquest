# RELEASE READINESS — GandalNexus v1

> Production deployment checklist. State **2026-11-15 · LOT 14 → 69**.
> Statuses: ready · partial · blocker · out of scope v1.

## 1. Security

| Item | Status | Comment |
|---|---|---|
| Security headers (XCTO, XFO, Referrer-Policy, Permissions-Policy) | ready (LOT 82) | HSTS 1 year prod only. Strict CSP deferred (nonces to wire). |
| HttpOnly + Lax + Secure session cookie | ready | Secure active if NODE_ENV=production. |
| CSRF HMAC double-submit | ready | 26/29 mutation routes (3 exempted and documented). |
| Password hashing scrypt + salt 16B + timing-safe | ready | |
| Password min length ≥ 10 chars | ready | LOT 14. |
| Rate-limit (Redis + fallback) | ready | userId + IP on BitLab routes, user-only elsewhere. |
| JWT secrets validated at boot (prod) | ready | Throws if missing in NODE_ENV=production. |
| Anti-replay nonce (Redis SET NX) | ready | Launch token + challenge + verify-return. |
| Lightning rewards: 24h/7d sliding caps | ready | LOT 14, defense against sendReward loops. |
| Kill-switch `LND_SEND_REWARDS_LIVE=1` | ready | OFF by default, explicit ops opt-in. |
| CORS allowlist for BitLab-facing public routes | ready | `BITLAB_ALLOWED_ORIGINS` strict in prod. |
| Global logout | ready | LOT 14. |
| pino logger + secret redaction | ready | |

## 2. Reliability

| Item | Status | Comment |
|---|---|---|
| 5s timeout on mempool / blockstream calls | ready | `AbortController`. |
| mempool → blockstream fallback | ready | transparent tryGet. |
| Automated Postgres backup | partial | `scripts/backup-postgres.sh` scripts ready; cron to configure in prod. |
| Postgres restore tested | ready | `scripts/restore-postgres.sh` + doc in `POSTGRES_PROD.md`. |
| MissionAttempt idempotence (double-submit) | ready | Atomic conditional `updateMany`. |
| MissionAttempt expiration 2h | ready | Idempotent EXPIRED transition. |
| Redis anti-replay available | partial | If Redis down → `log.warn` + disabled. Monitor. |

## 3. Quality

| Item | Status | Comment |
|---|---|---|
| vitest tests | ready | **888/888 green** (BitQuest) + 154/154 (BitLab). |
| tsc typecheck | ready | Exit 0 on both sides. |
| ESLint | ready | Exit 0 BitQuest, 1 known warning BitLab (cross-origin logout). |
| CSRF / Zod / logger coverage (frozen) | ready | Property tests. |
| Playwright E2E | partial | 8 scenarios (6 smoke + quest-flow + admin-search). No COMPLETED mission flow. |

## 4. Observability

| Item | Status | Comment |
|---|---|---|
| pino structured logger | ready | Categorized scopes (bitlab-proof, lightning-rewards, audit, …). |
| Sentry opt-in via DSN | ready | Ops guide `SENTRY_OPS.md`. |
| Sentry business warnings (LOT 31) | ready | LND reward wire failure + cron purge > 100. |
| Configured Sentry dashboards | out of scope | Ops decision to take; guide provided (alert >10 err/min). |
| Health endpoint | ready | `/api/health` + `/admin/health`. |
| Admin analytics (completion %, friction) | ready | Live Prisma queries. |
| Admin ops 24h alerting (LOT 16) | ready | BitLab proof outcomes + Lightning rewards on `/admin`. |
| Admin audit log 29 actions (LOT 33) | ready | Filters by kind, includes ChapterQuest + FeatureFlag. |

## 5. Documentation

| Doc | Status | Role |
|---|---|---|
| `FEATURES-INVENTORY.md` | ready (LOT 14) | Feature inventory. |
| `IMPLEMENTATION-STATUS.md` | ready (LOT 14) | Acceptance criteria per block. |
| `BITQUEST-BITLAB-INTEGRATION.md` | ready (LOT 14) | Protocol + states + errors. |
| `TECHNICAL-DEBT.md` | ready (LOT 14) | Classified debt. |
| `RELEASE-READINESS.md` | ready (LOT 14) | This document. |
| `BITQUEST_ARCHITECTURE.md` | ready | History. |
| `BITQUEST_ROADMAP.md` | ready | Phases 0-5. |
| `SECURITY_CHECKLIST.md` | ready (LOT 19) | ≥ 10 chars + dedicated line. |
| `POSTGRES_PROD.md` | ready | Backup/restore procedure. |
| `SENTRY_OPS.md` | ready | Sentry activation + GDPR. |
| `DOCKER_DEVELOPMENT.md` | ready | Dev with compose. |
| `DOCKER_LND.md` | ready | Opt-in LND testnet. |
| `I18N_WOLOF.md` | ready | Wolof i18n guide. |
| `PHASE_3_BITLAB.md` | ready | Historical PHASE_3 state. |
| `OPS_RUNBOOK.md` | ready (LOT 78) | Secrets, cron, dashboards, incidents. |
| `public/openapi.yaml` | ready (LOT 79) | OpenAPI 3.1 of the 4 public routes (verify, version, nostr.json, health). |
| `public/manifest.webmanifest` | ready (LOT 80) | Installable PWA (standalone, Bitcoin theme, 3 shortcuts). |
| `src/app/sitemap.ts` + `robots.ts` | ready (LOT 81) | SEO: dynamic sitemap (academy slugs) + robots filtering admin/me/wallet. |

## 6. v1 Out-of-Scope Blockers

- Encryption at-rest for BitLab keys: **opt-in backup delivered
  (LOT 18/20)**, full migration IndexedDB plaintext → ciphertext
  remains to be done before going mainnet. V1 testnet-only acceptable.
- Verifiable certification: foundation delivered (LOT 25-30) — Auto
  Attestation + HMAC Certificate + public verify route + /verify page.
  V2 Schnorr-secp256k1 for NIP/Nostr cross-origin offline remains to
  be done if we want native Nostr interop.

## 7. Required Environment Variables in Prod

```bash
# Database
DATABASE_URL=postgres://user:pwd@host:5432/bitquest

# Redis (mandatory)
REDIS_URL=redis://host:6379

# Secrets (32 bytes min, ritual rotation documented)
CSRF_SECRET=<32+ random bytes>
BITLAB_JWT_SECRET=<32+ random bytes>
BITLAB_LAUNCH_SECRET=<32+ random bytes> # optional, fallback to BITLAB_JWT_SECRET
BITLAB_SIGN_SECRET=<32+ random bytes>   # optional, HMAC deep-link

# SSO
BITLAB_ALLOWED_ORIGINS=https://bitlab.example.com

# Observability (opt-in)
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.1

# Lightning rewards (OFF by default)
LND_REST_URL=https://lnd:8080
LND_MACAROON_HEX=<hex>
LND_SEND_REWARDS_LIVE=0  # 1 to enable real payments

# Cron ops (LOT 22)
CRON_SECRET=<32+ random bytes>  # X-Cron-Secret for /api/cron/*

# Certificates (LOT 28)
CERT_SIGN_SECRET=<32+ random bytes>  # optional, fallback to CSRF_SECRET
NEXT_PUBLIC_BITQUEST_HOST=bitquest.example.com  # for the `issuer` field

# Node
NODE_ENV=production
```

## 7bis. Public Auto-Discovery Endpoints (LOT 44)

Third-party integrations (BitLab, future Nostr portfolio, NIP-11 relay)
can ping these read-only endpoints without auth:

| Endpoint | Role | LOT |
|---|---|---|
| `GET /api/version` | `{ protocolVersion, certificateVersion, release, commitHash, issuer, builtAt }` | 44 |
| `GET /api/health` | DB + Redis status | 5.1a |
| `GET /api/certificates/verify?blob=<signed>` | Verifies an HMAC Certificate | 29 |
| `GET /verify` | HTML verification page for a human | 30 |

**Cross-cutting headers** (LOT 42/43) on JSON responses:
- `X-Protocol-Version: 1`
- `X-Certificate-Version: 1`

Client pattern:
```ts
const { protocolVersion } = await fetch(`${issuer}/api/version`).then((r) => r.json());
if (protocolVersion > 1) throw new Error("Downgrade required");
```

## 8bis. Smoke Test Routes (LOT 40, +LOT 44)

Script `scripts/smoke-routes.sh` verifies in ~5s the 21 exposed routes
(public + API + auth-required + admin): expected response codes.

```bash
BASE=http://localhost:3000 ./scripts/smoke-routes.sh
# or against staging:
BASE=https://staging.bitquest.example.com ./scripts/smoke-routes.sh
```

Output: `PASS: 21  FAIL: 0` if all green (anonymous + no-auth
paths only — for authenticated scenarios, Playwright
E2E).

## 8. D-Day Checklist

- [ ] Pre-release Postgres backup tested.
- [ ] Secret rotation validated (new set applied, old archived 7 days).
- [ ] `docker compose up -d` or CI/CD pipeline applied.
- [ ] `npx prisma migrate deploy` executed.
- [ ] HTTP smoke test on 29 pages (app + admin + studio) → 200.
- [ ] Health endpoint 200.
- [ ] CSP / HSTS / rate-limit NGINX configured.
- [ ] DNS `bitquest.example.com` + `bitlab.example.com`.
- [ ] Redis + Postgres monitoring (RAM, disk, connection count).
- [ ] Verify `BITLAB_ALLOWED_ORIGINS` contains prod BitLab URL.
- [ ] Verify `LND_SEND_REWARDS_LIVE=0` (remains OFF until external audit).
- [ ] Prod opening log in the ops journal.

## 9. Rollback

- `docker compose down && docker compose up -d` on the previous image.
- Postgres: `scripts/restore-postgres.sh <dump>.gz` (duration ~ 2-3 min
  on < 1M rows).
- BitLab: static Vercel-like image, rollback via git tag or
  previous artifact.
