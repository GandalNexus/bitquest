# TECHNICAL DEBT — GandalNexus

> Technical debt status as of 2026-11-14 · LOT 14.
> Classification: **blocker** · **important** · **minor** · **acceptable**.

## 1. Blocker (P0 — to address before serious prod deployment)

No unaddressed blocker as of 2026-11-14. The P0 gaps identified during
the audit have been closed by LOT 14:

- ~~Password min length 6~~ → bumped to 10.
- ~~Lightning rewards without sliding caps~~ → 24h/7d caps added.
- ~~Mempool without timeout~~ → already in place (audit was wrong).
- ~~Missing BitLab → BitQuest global logout~~ → route
  `/api/auth/bitlab-logout` + `?logged_out=1` branch delivered.

## 2. Important (P1 — to address before public release)

### BitLab · At-rest key encryption

- **Problem**: `bitlab/src/lib/wallet/store.ts` stores mnemonic + WIF
  in cleartext in IndexedDB. An attacker who takes control of the
  browser (XSS, BitLocker off, malware) extracts all the keys.
- **Impact**: v1 testnet/signet only (no real funds).
  **Blocker if we ever want to move from signet/testnet to mainnet.**
- **Action**: derive an encryption key from a user passphrase
  (PBKDF2/scrypt), encrypt sensitive fields with
  AES-GCM, store the ciphertext. Passphrase prompt at boot or
  on use. Alternative: WebAuthn + non-exportable CryptoKey.

### ~~BitQuest · ChapterQuest gate not enforced~~ → **resolved LOT 16**

- Pure helper `computeChapterLock()` + `getCourseTree` enrichment
  with `locked` + `prerequisites` + UI Lock badge.
- Semantics: anonymous preview, authenticated = pedagogical gate.
- Remaining: seed `ChapterQuest` entries to activate the feature
  (the table is currently empty in dev).

### ~~BitQuest · Lightning reward auto-trigger on quest completion~~ → **resolved LOT 15**

- "Claim in real sats" CTA on `RewardsStep` when
  `sats.granted > 0` → navigates to `/rewards?from=<questCode>`.
- Contextual banner on `/rewards` with strict anti-injection regex
  (`parseQuestCodeHint`).
- Conservative decision: no server-side invoice auto-generation
  — the user always pastes their own BOLT11 (non-custodial).

### ~~BitQuest · Incomplete Wolof~~ → **resolved LOT 59-69 (100%)**

- Coverage moved from 34% (138/410) to **100%** (412/412) across 8
  successive i18n LOTs (LOT 59, 62, 63, 64, 65, 66, 67, 68, 69).
- Translated blocks: status, tracks, leaderboard, dailyChallenge,
  profile, wallet, questMap, player, intro, theory, quiz, mission,
  bitlabProof, missionPanel, blockExplorer, keyForge, feeOpt,
  txBuilder, mineNonce, lnChannel, lnInvoice, multisig, taproot.
- +268 WO keys added without regression (898/898 tests green).
- **Literary quality**: LOT 73 documented the Wolof glossary
  in `docs/I18N_WOLOF_GLOSSAIRE.md` with harmonized technical
  vocabulary, contribution process and per-block marking. The
  warning-flagged blocks (~315 keys) fall under editorial governance:
  native proofreading to refine the pedagogical tone, out of scope v1 code.

## 3. Minor (P2 — if time available)

### Missing search on several admin CRUDs

- **Problem**: Courses, Chapters, Lessons, Badges, Challenges,
  TeamMembers have no server-side search. Beyond ~50
  entries, the admin becomes unusable.
- **Action**: copy the `/admin/users` pattern (ILIKE + pagination 25).

### BitLab mobile responsive (6 modules)

- **Problem**: `sm:/md:/lg:` classes are present but no device-by-device
  QA. The mobile tab bar of `page.tsx` is likely
  narrow.
- **Action**: manual QA 375px (iPhone SE), 390px (iPhone 12+), 768px
  (iPad). Fix anything that overflows.

### Minimal Playwright E2E (6 smoke scenarios)

- **Problem**: no coverage of full mission flow, no admin CRUD,
  no reward redemption.
- **Action**: at least 3 path scenarios:
  1. Register → quest complete → gain XP visible dashboard.
  2. Admin creates a course → publish → visible on `/academy`.
  3. Deep-link → BitLab → proof mock → return → quest completed.

### `BITLAB_SIGN_SECRET`: ambiguous usage

- **Problem**: referenced in the doc; grep finds no
  usage in `src/`. `BITLAB_JWT_SECRET` and `BITLAB_LAUNCH_SECRET`
  do all the work.
- **Action**: either actually use it (HMAC deep-link via dedicated secret),
  or remove from doc + `.env.example`.

## 4. Acceptable (do not fix without business reason)

### `db/custom.db` SQLite vestige

- File not read by the application (Prisma points to Postgres for
  a long time). Can be deleted but no urgency. Noted in
  `POSTGRES_PROD.md`.

### Roles `APPRENTICE | EDITOR | ADMIN` vs. historical doc `LEARNER | AUTHOR | ADMIN`

- Historical product doc mentioned `LEARNER / AUTHOR`. The code
  uses `APPRENTICE / EDITOR`. Identical semantics, no real
  debt — just harmonize the prose when touching product
  docs.

### Legacy fallback deep-link without `v`

- URLs emitted before LOT P0.3 (without `v` field) continue to
  verify correctly via fallback. They disappear within the
  TTL window. Do not remove the fallback before a documented
  grace window.

### BitLab 2h session token without granular revocation

- The `User.token` rotation (global logout) cuts all tokens
  in practice (BitQuest-side requests fail), but JWTs remain
  valid until expiry. Acceptable for v1 — if one day we want granular
  revocation, use `jti` + Redis list.

## 5. Documentation Debt

- **Historical roles** (point 4): harmonize when the opportunity
  arises.
- ~~`SECURITY_CHECKLIST.md` still mentions "password 6+ chars"~~
  → resolved LOT 19 ("≥ 10 characters (LOT 14)" line added).
- ~~`BITQUEST_AUDIT.md` lists "password 6+ chars (too weak)"~~
  → resolved LOT 19 (prose updated "≥ 10 chars (bumped LOT 14)").

## 6. Critical External Dependencies

| Dependency | Status | Fallback | Action |
|---|---|---|---|
| Postgres 16 | Prod ready | — | Monitor vacuum, backup cron |
| Redis | Prod ready | In-memory (dev only) | Monitor availability |
| mempool.space | Public external | blockstream.info | Nothing to do, double fallback OK |
| LND REST | Opt-in | DECLARATIVE mode | Documented, not mandatory |
| Sentry | Opt-in via DSN | local log | Ops decision to take |

## 7. Auto Update

This file is append-only for resolved debts (strike through, do not
delete). New debts are added to the appropriate section. A
lot that closes a debt updates the line with prefix `~~…~~` + link
to the commit.
