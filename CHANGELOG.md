# Changelog

All notable changes to BitQuest are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-11-11

Consolidation release. Hardens the stack for production: PostgreSQL + Redis,
observability, CSRF/roles, admin console, BitLab proof foundation, i18n,
RGPD soft-delete, and a11y audit.

### Added

#### Infrastructure & data
- **PostgreSQL** as primary database. Migrated from SQLite with versioned
  Prisma migrations under `prisma/migrations/`.
- **Redis** for session storage, rate-limiting, and anti-replay nonces, with
  in-memory fallback when Redis is unreachable.
- `/api/health` endpoint + admin status page with DB and Redis probes.
- **Sentry** client + server instrumentation (no-op if `SENTRY_DSN` is unset).
- **pino** structured logging with automatic PII redaction.

#### Security & auth
- HttpOnly `bq_session` cookie (replaces header-only legacy auth).
- CSRF double-submit (`bq_csrf`) with HMAC stateless derivation.
- Role model (`APPRENTICE` / `EDITOR` / `ADMIN`) with `requireRole`,
  `requireRoleSsr`, and `requireRoleAndCsrf` helpers.
- **Zod** validation at every API boundary with discriminated unions.
- Redis-backed per-route **rate-limit** with in-memory fallback.
- **Soft-delete** for user accounts (RGPD) with PII anonymization, plus
  admin hard-delete purge endpoint.
- **Password change** endpoint with session rotation.
- **Email verification** foundation: one-shot token, `/api/auth/verify-email`,
  `/api/auth/verification/send` (no SMTP wired yet — URL is logged).

#### Admin console
- Server-gated `/admin` shell with overview dashboard.
- CRUD for courses, chapters, lessons, quests (metadata + theory sections +
  quiz builder + mission type editor), badges, daily challenges, and users
  (role changes).
- **AdminAuditLog** model: every admin mutation is recorded (24+ action types).

#### Learning layer
- **Académie** module: hierarchical courses → chapters → lessons with markdown
  content and completion tracking.
- **Daily Challenge**: `DailyChallenge` + `DailyChallengeCompletion` with XP
  and sats rewards.
- Deep-link SPA routes for every main view (Sprint 1C).
- Onboarding checklist and Academy teaser on the dashboard (Sprint 1A).

#### BitLab integration (Phase 3 foundation)
- `BitLabProof` model to persist on-chain / Lightning proofs.
- `MempoolClient` (mempool.space + blockstream fallback) for TX verification.
- `/api/bitlab/proof` endpoint accepting `TX` or `INVOICE` kinds.
- **BOLT11 decoder** via `bolt11` npm; mainnet invoices are rejected.
- **JWT challenge** flow via `jose` (HS256) with Redis anti-replay nonce.
- Quest `missionKind` field (`SIMULATED` | `BITLAB_PROOF`); `tx-basics`
  pilot wired on `BITLAB_PROOF`.

#### Internationalization
- i18n FR/EN foundation with cookie-based locale switch (`bq_locale`).
- `useT()` hook with `{var}` interpolation.
- Auth screen tabs, dashboard hero/stats/cards/tracks/badges/activity/streak
  migrated to `t()` with FR/EN parity.

#### Tests & CI
- **Playwright** E2E suite: 9 scenarios (auth, admin gate, daily challenge).
- **@axe-core/playwright** WCAG 2.1 AA audit.
- CI pipeline enriched with Postgres + Redis services and a Playwright job.
- Unit coverage grew to **310 tests** across 17 files.

#### Docs
- `docs/PHASE_3_BITLAB.md` — scope, limits, curl examples.
- `docs/SECURITY_CHECKLIST.md` — Phase 5.5 preparedness.
- `docs/PHASE_0_REPORT.md`, `docs/SPRINT_1B_SCHEMA_PLAN.md`,
  `docs/LOT_1_DASHBOARD_ACADEMIE.md`.
- `docs/RELEASE_NOTES_v0.3.md` (this release).

### Changed
- Default database is Postgres. SQLite is no longer supported in dev config.
- Auth transport is cookie-first; legacy `x-gn-*` headers retained only for
  a transitional window.
- `prisma/seed.ts` sets `missionKind: BITLAB_PROOF` for `tx-basics`.
- Node 20 pinned in CI and Docker images.

### Removed
- 36 unused shadcn/ui primitive components (Phase 0 hygiene).

### Security
- All mutation routes enforce CSRF + role + rate-limit.
- Session cookies are HttpOnly, SameSite=Lax, Secure in production.
- pino redactions cover `password`, `token`, `authorization`, and cookies.

## [0.2.1] — pre-consolidation

Sprint 1A/1B/1C baseline: dashboard polish, Académie teaser, onboarding
checklist, deep-link SPA routes, and schema proposal for the data layer.
Full history in commits `00cce1e` and earlier.
