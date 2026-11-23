# Changelog

All notable changes to BitQuest are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — 2026-11-11

Phase 3 BitLab end-to-end + full i18n coverage + email delivery wired.
Lifts the stack from "foundation" to "demonstrable" for the BitLab
proof loop and prepares a Wolof locale for community contribution.

### Added

#### BitLab integration (Phase 3 complete)
- **`BitLabProofStep`** UI in `quest-player.tsx`: dedicated form per
  kind (TX/BLOCK/INVOICE/CHANNEL/ADDRESS) with validation regex, field
  label and placeholder tailored to each proof type. Chains
  `/api/bitlab/challenge` → `/api/bitlab/proof` → `mission_submit`
  server-side. `missionKind` now exposed in `QuestState` +
  `QuestDetail.quest`.
- **`toBitlabKind(missionType)`** helper
  (`src/lib/bitlab/mission-kinds.ts`) maps mission types
  (`tx_builder`, `block_explorer`, `ln_invoice`, `ln_channel`,
  `mine_nonce`, `address_derive`) to their expected proof `kind`.
- **JWT challenge** is now **mandatory** on `/api/bitlab/proof`
  (`bitlabProofSchema.challenge` required, min 16 chars).
- **`LightningClient`** (`src/lib/bitlab/lightning.ts`): resolves a
  channel via mempool.space `/api/v1/lightning/channels/{id}`
  (mainnet) with `resolveChannel(network, scid)` dispatcher that picks
  LND REST on testnet/signet/regtest when configured.
- **`LndClient`** (`src/lib/bitlab/lnd.ts`): queries
  `GET /v1/graph/edge/{chan_id}` with macaroon header and self-signed
  TLS support. `scidToChanId()` encodes `<block>x<tx>x<vout>` into the
  BOLT 07 uint64 chan_id. Config via `LND_REST_URL`,
  `LND_MACAROON_HEX`, `LND_TLS_INSECURE`, `LND_TLS_CERT_B64` (PEM
  pinning with timing-safe verification).
- **Deep-link protocol** BitQuest ↔ BitLab
  (`src/lib/bitlab/deep-link.ts`): `buildBitlabDeepLink()` composes
  the sender URL (`questCode`, `kind`, `network`, `returnTo`, optional
  signed `ts`+`sig`); `parseBitlabReturn()` validates receiver URLs
  per kind (hex64 for TX/BLOCK, `ln…` for INVOICE, scid or chan_id for
  CHANNEL, bech32/base58 for ADDRESS). Receiver cleans URL via
  `router.replace(pathname)`.
- **HMAC deep-link signature** (optional) via `BITLAB_SIGN_SECRET`:
  canonical payload `${userId}|${questCode}|${kind}|${network}|${ts}`
  signed HMAC-SHA256 base64url, max age 1h, timing-safe comparison.
  Two endpoints: `POST /api/bitlab/deep-link` (sign) and
  `POST /api/bitlab/deep-link/verify-return` (verify).
- **Audit log**: new `BitLabProofAttempt` Prisma model tracks every
  submission (ACCEPTED / REJECTED / NOT_FOUND / UNAVAILABLE /
  INVALID_JWT / MEMPOOL / BAD_REQUEST / RATE_LIMITED) with latency.
  Admin page `/admin/bitlab/attempts` lists entries with filters
  (outcome, questCode), 24h stats (success rate, average latency,
  breakdown by outcome), and CSV export (10 000-row cap, RFC 4180,
  BOM UTF-8 for Excel).
- **Pilot extended** from `tx-basics` to 5 BITLAB_PROOF quests:
  `tx-basics`, `utxo`, `fees-mempool`, `lightning-invoice`, `lightning`.

#### Infrastructure
- **LND testnet** container added to `docker-compose.dev.yml` under the
  `lnd` profile (opt-in, not started by default). Neutrino backend
  (no bitcoind required), persistent `lnd_data` volume, tlsextradomain
  for Docker network resolution.
- `scripts/lnd/init-wallet.sh` — idempotent wallet creation via REST
  (`/v1/genseed` + `/v1/initwallet`).
- `scripts/lnd/extract-creds.sh` — prints readonly macaroon hex + base64
  tls.cert in `.env` format.

#### Email delivery
- **Mailer abstraction** (`src/lib/mail/mailer.ts`): dispatches
  `MAIL_PROVIDER` = `resend` | `none`. Resend uses the REST API via
  fetch (no SDK dep). Never throws: returns `{ ok: false, error }` on
  failure so callers can degrade gracefully.
- **Verification email template**
  (`src/lib/mail/templates.ts`): HTML + text versions, inline-style
  dark-mode card with CTA button, HTML escaping of pseudo + URL to
  prevent XSS.
- **Registration** and **`POST /api/auth/verification/send`** now
  dispatch the email via `sendVerificationEmail`. `devUrl` is still
  returned in dev when no provider is configured.

#### Internationalization (FR/EN complete, Wolof skeleton)
- **Every user-facing component** now uses `useT()`: dashboard,
  auth-screen, app-shell, quest-map, quest-player (5 steps +
  BitLabProofStep + rewards), mission-panel (9 mission sub-components +
  frame + feedback), profile-view, wallet-view, leaderboard,
  daily-challenge-tile, password-change-form, account-delete-form. ~320
  total keys in fr.json / en.json.
- Shared translation keys for `tracks.*`, `status.*`, `rarity.*`
  consumed via `t()` by all consumers; `trackStyles` / `rarityStyles`
  / `statusLabels` keep CSS classes only.
- **Wolof locale skeleton**: `src/i18n/messages/wo.json` with 16
  anchor keys (navigation, auth, common buttons). Remaining keys fall
  back to FR via `translate()` — empty strings in wo.json are treated
  as absent, enabling partial contributions.
- Language switch cycles `fr → en → wo → fr`.

#### Routing
- Deep-link route group `src/app/(app)/` with per-view pages
  (`/dashboard`, `/quests`, `/quests/[code]`, `/profile`, `/wallet`,
  `/leaderboard`). Shared `AppGate` layout gates by session + `useMe`
  profile + `AppShell`. Shared `loading.tsx` for smooth transitions
  (Sprint 1C).

### Changed
- `prisma/seed.ts` : `BITLAB_PROOF_QUESTS` set controls which quests
  wire on the proof flow (now 5 quests).
- `translate()` treats empty-string values as absent → enables partial
  locale files (used by `wo.json`).

### Security
- JWT challenge now **mandatory** on `/api/bitlab/proof`; stateless
  flow replaced with enforced anti-replay.
- CHANNEL verification uses LND macaroon + TLS pinning when configured.
- Every `/api/bitlab/proof` call is auditable via
  `BitLabProofAttempt`.

### Docs
- `docs/PHASE_3_BITLAB.md` — comprehensive reference (JWT, LND,
  deep-link protocol, HMAC, audit log, config env, examples).
- `docs/DOCKER_LND.md` — LND docker compose setup (wallet init,
  credential extraction, troubleshooting, reset).
- `docs/EMAIL.md` — mailer setup (Resend), config, template details,
  upgrade path.
- `docs/I18N_WOLOF.md` — contributor guide (orthography, PR workflow,
  anchor keys, fallback behavior).

### Tests
- **399 total** (+89 vs 0.3.0): mission-kinds, lightning, lnd, deep-link,
  audit, mailer, templates, dictionaries.
- Lint 0 errors (2 pre-existing `performance.now()` warnings in
  MineNonce).

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
