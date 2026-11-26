# IMPLEMENTATION STATUS — GandalNexus

> Implementation status **per acceptance criterion** (vs. the
> "Mission audit / finalization" prompt). Updated 2026-11-14 · BATCH 14.
>
> Structure: Platform · Module · Status · Files · Tests · Issues ·
> Remaining action · Acceptance criterion.

## P0 — Security, integrity, reliability

### BitQuest · Auth sessions & JWT

- **Status**: DONE
- **Files**: `src/lib/bitquest/session.ts`, `src/lib/auth/csrf.ts`,
  `src/lib/auth/launch-token.ts`, `src/lib/bitlab/jwt.ts`
- **Tests**: `csrf.test.ts`, `session.cookies.test.ts`,
  `launch-token.test.ts`, `jwt.test.ts`, `flow.e2e.test.ts`
- **Issues**: none.
- **Acceptance criterion**: HttpOnly+Lax+Secure(prod) cookie, CSRF
  HMAC double-submit on all mutation routes, versioned JWT
  (v: 1), Redis anti-replay nonce. **Met.**

### BitQuest · Rate limiting

- **Status**: DONE
- **Files**: `src/lib/bitquest/session.ts:rateLimit`,
  `src/lib/cache/redis.ts`
- **Tests**: `flow.e2e.test.ts:rate-limit IP`
- **Criterion**: Redis sliding window + in-memory fallback, buckets
  per userId **and** IP on `/api/bitlab/*`. **Met.**

### BitQuest · Password min length ≥ 10

- **Status**: DONE (BATCH 14)
- **Files**: `src/lib/validation/schemas.ts:21,468`,
  `src/components/bitquest/auth-screen.tsx:90,306`,
  `src/components/bitquest/password-change-form.tsx:36`, i18n fr/en/wo
- **Tests**: `schemas.test.ts:changePasswordSchema` (adjusted)
- **Criterion**: Zod rejection if pw < 10 chars, consistent i18n label.
  **Met.**

### BitQuest · Lightning rewards — 24h / 7d caps

- **Status**: DONE (BATCH 14)
- **Files**: `src/lib/lightning/rewards.ts:sumRewardsSince`,
  `src/app/(app)/rewards/redeem-form.tsx` (UI codes)
- **Tests**: `rewards.test.ts` (+2 cases: daily cap, weekly cap)
- **Fixed issues**: a bug or an attacker triggering sendReward in a
  loop was bounded only by the per-invoice cap. Now the sum of
  PAID+PENDING over a sliding window caps the damage.
- **Criterion**: `INVOICE_OVER_DAILY_CAP` returned if `sum(24h) + amount
  > maxDailyMsat` (default 50k sats). Same for `INVOICE_OVER_WEEKLY_CAP`
  (200k sats / 7d). **Met.**

### BitQuest · Mempool timeout

- **Status**: DONE (already in place)
- **Files**: `src/lib/bitlab/mempool.ts:fetchWithTimeout`
- **Criterion**: `AbortController` 5s on all mempool requests
  (getTransaction, getBlock, getAddressStats). **Met.**

### BitQuest · MissionAttempt idempotence

- **Status**: DONE (BATCH 1)
- **Files**: `src/lib/bitlab/attempt.ts`, `src/lib/bitlab/consume.ts`
- **Tests**: `consume.test.ts`, `attempt.test.ts`, `flow.e2e.test.ts`
- **Criterion**: conditional updateMany on (id, state); a
  double-submitted proof returns 200 idempotent without re-crediting
  XP+sats. **Met.**

## P1 — Functional completion & integration

### BitQuest ↔ BitLab integration — full flow

- **Status**: DONE
- **Steps** (all verified):
  1. HMAC-signed deep-link `v: 1` → `bitquest/src/app/api/bitlab/deep-link/route.ts`
  2. Launch token JWT TTL 60s → `src/lib/auth/launch-token.ts`
  3. BitLab consume `/api/auth/verify-launch-token` → `bitlab/src/lib/bitquest-user.ts`
  4. Mission context parse → `bitlab/src/lib/bitquest-bridge.ts`
  5. Proof submit → `bitquest/src/app/api/bitlab/proof/route.ts`
  6. Attempt state machine → `src/lib/bitlab/attempt.ts`
  7. Signed return deep-link → `bitquest/src/app/api/bitlab/deep-link/verify-return/route.ts`
  8. Reward snapshot → `attempt.ts:snapshotAttemptResult`
- **Tests**: `flow.e2e.test.ts` (6 scenarios), `sso-e2e.test.ts` (4 scenarios)
- **Criterion**: uninterrupted flow from the BitQuest quest through
  progression update and reward flash. **Met.**

### Integration · GandalNexus global logout

- **Status**: DONE (BATCH 14)
- **Files**: `bitquest/src/app/api/auth/bitlab-logout/route.ts`,
  `bitlab/src/components/bitlab/header.tsx` (dropdown item),
  `bitlab/src/lib/use-bitquest-mission.ts` (`?logged_out=1` branch)
- **Tests**: `bitlab-logout/route.test.ts` (8 scenarios: returnTo,
  session, rate-limit, idempotence)
- **Fixed issue**: BitLab logout was purely local. Now a click on
  "Global logout" navigates top-level to BitQuest, which rotates
  user.token + clears cookies, then returns to BitLab with
  `?logged_out=1` → clears the local store.
- **Criterion**: once the flow completes, the user is no longer
  authenticated on the BitQuest side (cookie cleared, token rotated)
  nor on the BitLab side (sessionStorage store emptied). **Met.**

### BitLab · Wallet & Lightning

- **Status**: DONE except key encryption at-rest
- **Files**: see `FEATURES-INVENTORY.md` section BitLab
- **Issues**: keys (mnemonic/WIF) stored in plaintext in IndexedDB.
  Already noted in `TECHNICAL-DEBT.md`.
- **Criterion**: fully non-custodial (keys never leave the browser),
  PSBT/TX/LN functionality reached. **Met except encryption.**

### BitQuest · Full academy

- **Status**: DONE (CRUD) · PARTIAL (quest gate)
- **Files**: `src/app/(admin)/admin/{courses,chapters,lessons}/*`,
  `src/app/(studio)/*`, `src/app/(app)/academy/*`
- **Criterion**: full A→Z CRUD on courses/chapters/lessons/quests on
  the admin + studio sides. Lessons are MDX. ChapterQuest is not a
  required prerequisite. **Partially met** (see
  `TECHNICAL-DEBT.md` for the missing gate).

## P2 — UX, responsive, design system, translations

### i18n

- **Status**: DONE FR/EN · PARTIAL WO
- **Files**: `src/i18n/messages/{fr,en,wo}.json`
- **Criterion**: FR 410 keys (ref), EN 410 keys, WO 138 keys (34%).
  **Partially met** — Wolof to be completed for admin + rewards.

### BitLab mobile responsive

- **Status**: VERIFY
- **Files**: `bitlab/src/components/bitlab/*`
- **Criterion**: the 6 modules (wallet, tx-builder, lightning, mining,
  explorer, dashboard) usable at 375px. **Not validated on device**
  (sm:/md:/lg: classes present but no formal QA).

### Dark/light mode

- **Status**: DONE
- **Files**: `bitlab/src/components/bitlab/theme.tsx` +
  `bitquest/src/app/layout.tsx` (next-themes ThemeProvider in
  `providers.tsx`)
- **Criterion**: both modes rendered without hardcoded colors breaking
  contrast. **Met.**

## P3 — Marketplace, certifications, analytics, Nostr

- **Status**: SCHEMAS DONE · UI TODO
- **Files**: migration `20261113000000_add_feature_flag_attestation_certificate`,
  `src/lib/feature-flag.ts`, `src/lib/event-bus.ts`
- **Criterion**: Attestation + Certificate Prisma models in place
  (additive), internal event bus to wire analytics / Nostr later. UI,
  marketplace, Nostr flow intentionally not delivered in v1.
  **Partially prepared.**

## Global metrics

- Vitest tests: 824 (including BATCH 14: +2 rewards caps, +8 bitlab-logout)
- CSRF / Zod / logger coverage: **freeze-by-test** (anti-regression)
- BitQuest + BitLab typecheck: exit 0
- BitQuest + BitLab lint: exit 0
- Postgres migrations applied: 8 (all additive)
- BitLab WASM rebuild: 2026-11-14 `rust:1.82-bookworm`
