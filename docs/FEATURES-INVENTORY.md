# FEATURES INVENTORY — GandalNexus (BitQuest + BitLab)

> Audit snapshot **2026-11-15 · BATCH 14 → 33**. To be reconciled with the code
> via the tests before any "DONE" claim. Statuses:
>
> - **DONE**: implemented + tested + verified end-to-end.
> - **PARTIAL**: implemented but incomplete / reduced scope.
> - **VERIFY**: implemented, real-world behavior not demonstrated here.
> - **TODO**: absent or not functional.

## 1. BitQuest

### Auth & security

| Feature | Status | Files | Notes |
|---|---|---|---|
| Cookie `bq_session` HttpOnly + SameSite=Lax + Secure (prod) | DONE | `src/lib/bitquest/session.ts` | `buildSessionCookie()` in place. |
| CSRF double-submit (HMAC) | DONE | `src/lib/auth/csrf.ts` + `requireRoleAndCsrf` on 20+ admin routes | Explicit dev fallback, prod rejects at boot if `CSRF_SECRET` missing. |
| Password hashing scrypt + timing-safe compare | DONE | `src/lib/auth/password.ts` | Salt 16 B, scryptSync, `timingSafeEqual`. |
| Password min length 10 chars | DONE (BATCH 14) | `src/lib/validation/schemas.ts` + auth-screen + password-change-form + i18n fr/en/wo | Bump 6 → 10. |
| Rate-limit (Redis + in-memory fallback) | DONE | `src/lib/bitquest/session.ts:rateLimit` | Applied on `/api/auth/*`, `/api/bitlab/*`, `/api/me/*`, `/api/quests/*`. |
| Roles APPRENTICE / EDITOR / ADMIN | DONE | `src/lib/auth/roles.ts` + layouts `(admin)`, `(studio)` | Hierarchy `ROLE_RANK`, `requireRoleSsr`. |
| JWT secrets (BITLAB_JWT_SECRET, BITLAB_LAUNCH_SECRET) | DONE | `src/lib/bitlab/jwt.ts`, `src/lib/auth/launch-token.ts` | Fallback chain + throw in prod if absent. |
| Rotating logout + clear cookies | DONE | `src/app/api/auth/logout/route.ts` | Rotates `User.token`. |
| GandalNexus global logout (logout from BitLab) | DONE (BATCH 14) | `src/app/api/auth/bitlab-logout/route.ts` + BitLab dropdown | Mirror of `bitlab-sso`, rate-limit 30/60s, allowlist. |

### Academy / pedagogy

| Feature | Status | Files | Notes |
|---|---|---|---|
| Course / Chapter / Lesson / ChapterQuest models | DONE | `prisma/schema.prisma` | 4 migrations applied. |
| `LessonProgress` tracking | DONE | `prisma/schema.prisma` + `src/app/api/academy/lessons/[id]/complete/route.ts` | |
| Public academy UI (`/academy`, `/academy/[courseSlug]`) | DONE | `src/app/(app)/academy/*` | |
| Admin CRUD Course / Chapter / Lesson | DONE | `src/app/(admin)/admin/{courses,chapters,lessons}/*` | MDX editor (`@mdxeditor/editor`). |
| Admin CRUD Quest / Challenge / Badge / TeamMember / User-role | DONE (BATCH 13) | `src/app/(admin)/admin/*` | Search + pagination on Users and Quests. |
| Universal admin CRUD search | PARTIAL | — | Courses / Chapters / Lessons / Badges / Challenges / TeamMembers without search. |
| Studio portal (EDITOR) | DONE (BATCH 11 T2) | `src/app/(studio)/*` | Re-export of admin pages. |
| Per-chapter gate (mandatory quest to unlock) | TODO | — | `ChapterQuest` is not a required prerequisite. |

### BitLab proof flow

| Feature | Status | Files | Notes |
|---|---|---|---|
| HMAC-signed deep-link + version `v` | DONE | `src/app/api/bitlab/deep-link/route.ts`, `src/lib/bitlab/deep-link.ts` | Legacy compat (no `v`). |
| Launch token JWT HS256 TTL 60s + Redis nonce | DONE | `src/lib/auth/launch-token.ts` | aud=bitlab-user, single-use. |
| Top-level SSO (`/api/auth/bitlab-sso`) | DONE | `src/app/api/auth/bitlab-sso/route.ts` | Lax cookie, origin allowlist. |
| Challenge JWT (`/api/bitlab/challenge`) | DONE | `src/app/api/bitlab/challenge/route.ts` | version `v`, nonce anti-replay. |
| Proof verification: TX, BLOCK, INVOICE, CHANNEL, ADDRESS | DONE | `src/app/api/bitlab/proof/route.ts` | Mempool + Blockstream fallback, opt-in LND for CHANNEL. |
| DECLARATIVE mode (CHANNEL testnet without LND) | DONE | `src/lib/bitlab/channel.ts` | Declared by mission. |
| Durable MissionAttempt state machine | DONE | `src/lib/bitlab/attempt.ts` | 8 states, atomic updateMany. |
| History + resume (`/api/me/bitlab-attempts`) | DONE | `src/app/api/me/bitlab-attempts/route.ts` + dashboard tile | Resume via `attemptId`. |
| Snapshot rewards on completed attempt | DONE | `attempt.ts:snapshotAttemptResult` | Traces XP+sats+badges. |
| Audit log `BitLabProof` + admin CSV export | DONE | `src/app/(admin)/admin/bitlab/attempts/*` | |

### Lightning rewards

| Feature | Status | Files | Notes |
|---|---|---|---|
| `LightningReward` model (separate from simulated `User.sats`) | DONE | `prisma/schema.prisma` | |
| Feature flag `lightning.rewards` seeded OFF | DONE | `prisma/seed.ts` + `src/lib/feature-flag.ts` | |
| Env kill-switch `LND_SEND_REWARDS_LIVE=1` | DONE | `src/lib/lightning/rewards.ts` | Guard 5. |
| Per-invoice cap (100k sats default, override possible) | DONE | `rewards.ts` | |
| Sliding 24h / 7d caps | DONE (BATCH 14) | `rewards.ts:sumRewardsSince` | Default 50k / 200k sats, sum of PAID+PENDING. |
| Learner UI `/rewards` + redeem form | DONE | `src/app/(app)/rewards/*` | Error codes mapped to FR. |
| Admin `/admin/lightning-rewards` (list + filters + pagination) | DONE | `src/app/(admin)/admin/lightning-rewards/*` | |
| Strict sim / real isolation (tests) | DONE | `rewards.test.ts` | Verifies no writes to `User.sats`, `WalletTransaction`, `UserEvent`. |
| Auto-trigger on quest completion | TODO | — | V1: manual redemption only. |

### Attestations & certificates (BATCH 25-30)

| Feature | Status | Files | Notes |
|---|---|---|---|
| Event-bus handler `quest.completed` → auto Attestation | DONE | `src/lib/handlers/attestations.ts`, `instrumentation.ts` | Idempotent (P2002), non-blocking fail-closed. |
| API GET `/api/me/attestations` | DONE | `src/app/api/me/attestations/route.ts` + tests | Strict user scope, enriched targetTitle. |
| Learner page `/attestations` | DONE | `src/app/(app)/attestations/page.tsx` | Nav item BATCH 32. |
| Dashboard tile "My attestations" | DONE | `src/components/bitquest/dashboard.tsx` | Hidden if count=0. |
| HMAC-signed Certificate export | DONE | `src/lib/certificates/sign.ts`, `src/app/api/me/attestations/[id]/certificate/route.ts` | PBKDF2 not required — HMAC-SHA256. V2 Schnorr for NIP Nostr. |
| Public route `/api/certificates/verify` | DONE | `src/app/api/certificates/verify/route.ts` | Rate-limit IP 60/60s. |
| Public page `/verify` | DONE | `src/app/verify/page.tsx` | Share link copy from `/attestations`. |

### Industrialization

| Feature | Status | Files | Notes |
|---|---|---|---|
| Postgres 16 prod + 8 migrations | DONE | `prisma/migrations/*` + `docker-compose.yml` | Backup/restore scripts. |
| Structured pino logger + redaction + Sentry relay | DONE | `src/lib/log.ts`, `src/lib/obs/sentry.ts` | Opt-in via DSN. |
| Sentry business warnings (BATCH 31) | DONE | `src/lib/obs/sentry.ts:captureBusinessWarning` | Wire: reward LND failure + cron purge anomaly. |
| Cron purge MissionAttempt (BATCH 22) | DONE | `src/app/api/cron/purge-expired-attempts/route.ts` | X-Cron-Secret timing-safe. |
| Admin feature-flags toggle UI (BATCH 24) | DONE | `src/app/(admin)/admin/feature-flags/*` | ADMIN only, audit `FEATURE_FLAG_UPDATE`. |
| Full admin audit log (BATCH 33) | DONE | `src/app/(admin)/admin/audit/page.tsx` | +3 actions BATCH 23/24. |
| Next.js 15 instrumentation | DONE | `instrumentation.ts` | Replaces the 3 legacy `sentry.*.config.ts`. |
| A11y focus-visible + skip-link | DONE (BATCH 13) | `src/app/globals.css` + `layout.tsx` | |
| i18n FR (410) / EN (410) | DONE | `src/i18n/messages/{fr,en}.json` | |
| i18n Wolof (**412 keys = 100%** — BATCH 59-69) | DONE | `src/i18n/messages/wo.json` | FR fallback available via `dictionaries.ts:translate()`. Literary quality = out of scope for v1. |
| Admin analytics (completion %, friction) | DONE (BATCH 13) | `src/app/(admin)/admin/page.tsx` | Live Prisma `groupBy`. |
| Playwright E2E (6 scenarios) | PARTIAL | `tests/e2e/*.spec.ts` | Smoke only. No mission flow. |
| Unit tests (vitest) | DONE | 812+ tests | Coverage CSRF, Zod, logger frozen. |
| Attestation / Certificate / FeatureFlag schemas | DONE (BATCH 11 T4) | migration `20261113000000_*` + `src/lib/feature-flag.ts` + `src/lib/event-bus.ts` | Preparation for future modules. |

## 2. BitLab

### Non-custodial wallet

| Feature | Status | Files | Notes |
|---|---|---|---|
| BIP39 generation (12/24 words) + HD BIP32 | DONE | `src/lib/wallet/keys.ts` | `@scure/bip39` + `@scure/bip32`. |
| P2PKH / P2WPKH / P2TR derivation | DONE | `src/lib/wallet/keys.ts` | `@scure/btc-signer`. |
| IndexedDB persistence (idb-keyval) | DONE | `src/lib/wallet/store.ts` | Store `bitlab-lab-state-v1`. |
| Encrypted keys at-rest | TODO | — | Mnemonic/WIF in plaintext in IndexedDB. |

### Bitcoin transactions

| Feature | Status | Files | Notes |
|---|---|---|---|
| PSBT / buildSignedTx | DONE | `src/lib/wallet/tx.ts` | `@scure/btc-signer`. |
| Fee estimation (vsize × feeRate) | DONE | `tx.ts:estimateVsize` | Dust limit 546 sats enforced. |
| Client-side signature only | DONE | `tx.ts:buildSignedTx` | No key ever leaves the browser. |

### Lightning (WASM / LDK)

| Feature | Status | Files | Notes |
|---|---|---|---|
| WASM `lnlab_bg.wasm` built with Rust 1.82 | DONE | `rust/lnlab/*`, `public/lnlab/*` | Rebuild 2026-11-14 via `rust:1.82-bookworm`. |
| Two LDK nodes (A/B) persisted in IndexedDB | DONE | `src/lib/lightning.ts` + `/lnlab/worker.js` | Fresh boot or restore. |
| open_channel / pay_invoice / create_invoice / close_channel | DONE | `rust/lnlab/src/lib.rs` | |
| `scidFormatted` exposure (block×tx×vout) | DONE (BATCH 11 T3) | `lib.rs:channels_of` | Ready for /api/bitlab/proof kind=CHANNEL. |
| "Submit to BitQuest" CTA on channel ready | DONE (BATCH 13) | `src/components/bitlab/lightning.tsx` | |

### Modules

| Feature | Status | Files | Notes |
|---|---|---|---|
| Mining (real PoW nonce + Web Workers) | DONE | `src/lib/mining/core.ts`, `miner.ts` + `/miner/worker.js` | sha256(sha256(header)) targeted. |
| Multi-network explorer | DONE | `src/lib/mempool.ts` | testnet3/4, signet, regtest via `/api/bitcoin` proxy. |
| Hero dashboard (StatCard + GandalNexusMissionCard) | DONE | `src/components/bitlab/*` | |

### GandalNexus integration (BitLab side)

| Feature | Status | Files | Notes |
|---|---|---|---|
| Deep-link parse (`parseBitquestMission`) | DONE | `src/lib/bitquest-bridge.ts` | 8 fields. |
| Mission store persisted in sessionStorage | DONE | `src/lib/bitquest-mission-store.ts` | Survives refresh. |
| User store persisted in sessionStorage | DONE | `src/lib/bitquest-user-store.ts` | Token + expiresAt. |
| Verify launch token (CORS → BitQuest) | DONE | `src/lib/bitquest-user.ts` | Bearer `sessionToken` afterwards. |
| Silent SSO (passive check ?silent=1) | DONE (BATCH 13) | `src/lib/use-silent-sso.ts` | localStorage TTL 10 min. |
| Global logout via `?logged_out=1` | DONE (BATCH 14) | `src/lib/use-bitquest-mission.ts` | Clear store + clean URL. |
| Mobile badge + logout dropdown | DONE | `src/components/bitlab/header.tsx` | Local + global logout. |
| Mobile responsive on 6 modules | VERIFY | `src/components/bitlab/*` | sm:/md:/lg: classes present, no device-by-device QA. |
| Dark mode (CSS class + localStorage) | DONE | `src/components/bitlab/theme.tsx` | Anti-FOUC boot script. |

## 3. Status recap (by block)

| Block | DONE | PARTIAL | VERIFY | TODO |
|---|---:|---:|---:|---:|
| Auth & security | 9 | 0 | 0 | 0 |
| Academy (gate BATCH 16/17 included) | 7 | 1 | 0 | 0 |
| BitLab proof flow | 11 | 0 | 0 | 0 |
| Lightning rewards | 9 | 0 | 0 | 0 |
| Attestations & certificates (BATCH 25-30) | 7 | 0 | 0 | 0 |
| Industrialization (BATCH 22/24/31/33) | 14 | 1 | 0 | 0 |
| BitLab wallet (BATCH 18/20 included) | 4 | 0 | 0 | 1 |
| BitLab TX | 3 | 0 | 0 | 0 |
| BitLab Lightning | 5 | 0 | 0 | 0 |
| BitLab modules | 3 | 0 | 0 | 0 |
| GN integration | 7 | 0 | 1 | 0 |

See also: `IMPLEMENTATION-STATUS.md` (acceptance criteria),
`TECHNICAL-DEBT.md` (debt), `BITQUEST-BITLAB-INTEGRATION.md` (flow),
`RELEASE-READINESS.md` (production checklist).
