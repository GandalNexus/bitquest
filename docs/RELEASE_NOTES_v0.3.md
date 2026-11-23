# BitQuest v0.3.0 — Release notes

**Date:** 2026-11-11
**Branch:** `phase-1-lot-1`
**Previous:** v0.2.1

## TL;DR

v0.3 is the **consolidation release**. It takes the Sprint-1 baseline (dashboard
+ Académie teaser + deep-link routes) and hardens everything underneath so the
project can plausibly carry traffic: PostgreSQL + Redis, Sentry, structured
logging, CSRF + roles everywhere, Playwright + a11y in CI, a full admin console,
the BitLab proof foundation (with one pilot quest), FR/EN i18n, and RGPD
soft-delete.

No pedagogical surface changes beyond the Daily Challenge and the Académie
module. Visible-user-facing behaviour is additive.

## Highlights

### Database — SQLite → PostgreSQL
Prisma datasource switched to `postgresql`. Dev stack now runs `postgres:16-alpine`
in Docker Compose. Versioned migrations live under `prisma/migrations/`.
Non-interactive flows use `prisma db push --accept-data-loss` + manual migration
file + `prisma migrate resolve --applied`.

### Session & CSRF
- `bq_session` cookie — HttpOnly, SameSite=Lax, Secure in production.
- `bq_csrf` cookie — readable, HMAC-derived from the session token (no server
  store, stateless double-submit).
- Mutations enforce `requireRoleAndCsrf(role)`.
- Legacy `x-gn-user-id` / `x-gn-token` headers still accepted during migration.

### Roles & admin
`APPRENTICE` / `EDITOR` / `ADMIN`. `/admin` is SSR-gated. The console covers:
courses, chapters, lessons, quests (metadata + theory + quiz + mission type),
badges, daily challenges, users (role toggle), plus **hard-delete purge** for
soft-deleted accounts. Every mutation hits `AdminAuditLog`.

### BitLab foundation (Phase 3)
Not a full integration yet — but the groundwork is in:
- `BitLabProof` persists verified on-chain/Lightning proofs per `(user, questCode, kind)`.
- `MempoolClient` queries `mempool.space` with a `blockstream.info` fallback.
- `POST /api/bitlab/proof` accepts `kind: TX` or `kind: INVOICE`. TX returns
  `409 { mempool: true }` when the transaction is unconfirmed. INVOICE uses
  `bolt11` and rejects mainnet.
- `POST /api/bitlab/challenge` issues a short-lived JWT (jose HS256) with a
  Redis-stored nonce for anti-replay.
- `Quest.missionKind = BITLAB_PROOF` consumes a fresh `BitLabProof` instead
  of running the SIMULATED verifier. `tx-basics` is the pilot quest.

See `docs/PHASE_3_BITLAB.md` for the full scope + limitations.

### Observability
- `/api/health` returns `{ ok, db, redis, latencyMs }` with degraded status
  past configurable thresholds. Admin status page surfaces it.
- Sentry via `@sentry/nextjs` on both client and server. No-op if `SENTRY_DSN`
  is unset — safe to deploy without a Sentry account.
- pino structured logs with redactions for `password`, `token`,
  `authorization`, and cookie headers.

### RGPD
`DELETE /api/me` (soft-delete) anonymizes PII in place and flips `deletedAt`.
Admin `POST /api/admin/users/:id/purge` hard-deletes the row. Audited.

### i18n
- `bq_locale` cookie + `LocaleProvider` + `useT()` hook with `{var}`
  interpolation.
- FR (source) and EN translated with parity.
- Migrated surfaces in this release: auth screen, dashboard
  (hero + stats + continue-learning card + tracks + badges + activity + streak).

### Tests
- Unit: **310 tests / 17 files** (schemas, missions, progression, academy,
  csrf, roles, server helpers, bolt11, mempool, challenges, health, log,
  cookies, Redis session).
- E2E Playwright: 9 scenarios (auth + admin gate + daily challenge).
- Axe-core WCAG 2.1 AA audit on dashboard + quest pages.

## Upgrade notes

### If you're on 0.2.x
1. Snapshot your database.
2. Switch `DATABASE_URL` to Postgres. Add `REDIS_URL`.
3. `docker compose -f docker-compose.dev.yml up -d postgres redis`.
4. `npm run db:push && npm run db:seed`.
5. Set `CSRF_SECRET`, `SESSION_COOKIE_SECRET`, optionally `BITLAB_JWT_SECRET`
   and `SENTRY_DSN`.

### Breaking
- SQLite is no longer supported in dev config.
- Clients relying on header-only auth must migrate to cookies before the next
  release — the legacy shim ships but will be removed in v0.4.

## What's next (v0.4 candidates)

- SMTP wiring for email verification.
- WO locale (third i18n target).
- Finish migrating the remaining components (quests, wallet, academy views)
  to `useT()`.
- Expand BITLAB_PROOF beyond `tx-basics` (invoice-decode, channel-open).
- Dedicated changelog bot + release tags.

## Credits

Thanks to Diallo for the direction and the sprint cadence. v0.3 includes 40+
commits since v0.2.1 — see `git log 00cce1e..HEAD` for the full trail.
