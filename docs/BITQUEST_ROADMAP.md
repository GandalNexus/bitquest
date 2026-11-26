# BitQuest Roadmap — 2026-11-09

> Progressive development plan to transform BitQuest from an **educational MVP with a solid business core** into a **reference Bitcoin educational platform**, complementary to BitLab. Based on `BITQUEST_AUDIT.md`, `BITQUEST_ARCHITECTURE.md`, `BITQUEST_FEATURE_MATRIX.md` and `BITQUEST_INTEGRATION_BITLAB.md`.
>
> The phases are **sequential at the "deliverable milestone" level** but **some tasks are parallelizable** within each phase. Each module specifies objective, features, affected files, dependencies, difficulties, tests and acceptance criteria.

---

## Phase overview

| Phase | Duration | Objective | Gatekeeper deliverable |
|---|---|---|---|
| **0 — Hygiene** | 1 week | Clean repository, ready to accept real work | Green CI build, no dead deps, SQLite→Postgres, unit tests on `progression.ts` |
| **1 — Security & robustness** | 2 weeks | Make the existing deployable in production | httpOnly cookie + CSRF + Zod + Redis + roles |
| **2 — Academy & admin** | 7 weeks | Allow editors to produce content | `/academy` + `/admin` full CRUD + i18n FR/EN |
| **3 — BitLab integration** | 2 weeks | "Practice" becomes real | One quest completable by testnet4 txid |
| **4 — Lightning rewards** | 6 weeks (optional) | Real "earn" loop | Lightning testnet payout, feature flag |
| **5 — Industrialization** | 3 weeks | Ready for a community | Monitoring, E2E, a11y, WO, pentest |

Total: **≈ 21 weeks** (≈ 5 months) for a solo senior full-stack dev. In pairs: 3 calendar months.

---

## Phase 0 — Hygiene (week 1)

### Objective
Put the repository in a clean state aligned with the documentation, without adding any business feature.

### Modules

#### 0.1 — `package.json` cleanup
- **Objective**: remove the "template" debt.
- **Features**:
  - Rename `nextjs_tailwind_shadcn_ts` → `bitquest`.
  - Remove `z-ai-web-dev-sdk`.
  - Audit `next-auth`, `next-intl`, `@mdxeditor/editor`, `@dnd-kit/*`, `recharts`, `embla-carousel-react`, `input-otp`, `react-resizable-panels`, `vaul`.
  - Remove the 36 unused `shadcn/ui` primitives.
- **Files**: `package.json`, `src/components/ui/*`.
- **Dependencies**: — .
- **Difficulties**: identify truly unused components (some are re-exported).
- **Tests**: `npm run build` passes without error.
- **Acceptance criteria**: `depcheck` no longer reports critical orphan deps. The `src/components/ui/` folder contains only what is imported.

#### 0.2 — Restore TypeScript verification
- **Objective**: prevent silent regression.
- **Features**:
  - Remove `typescript.ignoreBuildErrors` from `next.config.ts`.
  - Add `typecheck: "tsc --noEmit"` script.
  - Fix resulting errors.
- **Files**: `next.config.ts`, `package.json`, fixed TS files.
- **Dependencies**: 0.1.
- **Criteria**: `npm run typecheck` and `npm run build` pass.

#### 0.3 — Fix `vitest.config.ts` and set a baseline
- **Objective**: make tests executable.
- **Features**:
  - Fix `include` (paths `src/lib/bitquest/**`, `src/app/api/**`, `middleware.ts`).
  - Create an effective `__tests__/setup.ts` or remove the reference.
  - Write the first tests on `src/lib/bitquest/progression.ts` (XP, level, streak, `awardSats`).
- **Files**: `vitest.config.ts`, `__tests__/setup.ts`, `src/lib/bitquest/progression.test.ts`.
- **Dependencies**: 0.1.
- **Difficulties**: mock Prisma `db` (`vitest-mock-extended` or `@quramy/prisma-fabbrica` library).
- **Criteria**: `npm run test` outputs green, coverage > 60% on `progression.ts`.

#### 0.4 — SQLite → PostgreSQL migration + versioned migrations
- **Objective**: align the code with the specs.
- **Features**:
  - Modify `prisma/schema.prisma`: provider `postgresql`.
  - `prisma migrate dev --name init` → creates `prisma/migrations/`.
  - Confirm `docker-compose.yml` compatibility (already Postgres 16).
  - `db:up`, `db:migrate`, `db:seed`, `db:reset` scripts consolidated and documented.
  - Convert `String` fields storing JSON to native `Json` in a subsequent migration.
- **Files**: `prisma/schema.prisma`, `prisma/migrations/*`, `docker-compose.yml`, `.env.example`.
- **Dependencies**: 0.3 (to validate that the migration doesn't break anything).
- **Difficulties**: silent conversion of `JSON.parse(row.theorySections)` throughout the code — to be replaced by direct access to the typed field.
- **Criteria**: `docker compose up -d postgres && npm run db:migrate && npm run db:seed` works from a clean repo.

#### 0.5 — Fix `middleware.ts` or delete it
- **Objective**: no more misleading dead code.
- **Files**: `middleware.ts`.
- **Decision**: wait for phase 1 to rewrite once the cookie is set. In phase 0: comment out and leave an explicit TODO.

#### 0.6 — `QuizQuestion.quest2` cleanup
- **Objective**: remove orphan field.
- **Files**: `prisma/schema.prisma`, Prisma migration.

### Phase 0 gatekeeper deliverable
```
npm install && npm run lint && npm run typecheck && npm run test && npm run build
```
→ all pass. Clean repository, Postgres in place, test baseline set.

---

## Phase 1 — Security & robustness (weeks 2-3)

### Objective
Make the application deployable without shame in production (internal, then external).

### Modules

#### 1.1 — User roles
- **Features**:
  - Prisma enum `Role { APPRENTICE, EDITOR, ADMIN }`.
  - `User.role` field + migration.
  - `requireRole("ADMIN")` helper + `requireAuthenticated()`.
- **Files**: `prisma/schema.prisma`, `src/lib/bitquest/session.ts`, new `src/lib/auth/roles.ts`.
- **Criteria**: an ADMIN user can be created via `prisma studio`, tagged in the session.

#### 1.2 — Session in httpOnly cookie + CSRF
- **Features**:
  - Set-cookie on login/signup/guest: `session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/`.
  - Clear-cookie on logout.
  - Read the cookie (not custom headers) in `authenticate()`.
  - CSRF token generation (`X-CSRF-Token`) per session, also stored in a readable cookie.
  - CSRF verification on all mutations (`POST`, `PATCH`, `DELETE`).
  - Update the middleware accordingly.
- **Files**: `src/app/api/auth/route.ts`, `src/lib/bitquest/session.ts`, `src/lib/bitquest/client.ts`, `middleware.ts`.
- **Dependencies**: 1.1.
- **Difficulties**: smooth migration — accept legacy headers for a few more days to avoid disconnecting testers.
- **Criteria**: simulated CSRF attack blocked in test.

#### 1.3 — Zod validation at boundaries
- **Features**: a Zod schema per API route, per Server Action. `parse()` on input, inferred typing on output.
- **Files**: all `src/app/api/**/route.ts`.
- **Tests**: unit tests of schemas (invalid payload → clean 400).

#### 1.4 — Redis rate limiting
- **Features**:
  - Replace the in-memory Map with a Redis client (Upstash in prod, local image in dev).
  - Keys by IP (signup/login) and by userId (sensitive actions).
- **Files**: `src/lib/bitquest/session.ts`, new `src/lib/cache/redis.ts`, `docker-compose.yml`.
- **Criteria**: integration test that sends 101 requests in 1 min → the 101st receives a 429.

#### 1.5 — Unit tests of the domain layer
- **Features**:
  - Coverage > 80% of `src/lib/bitquest/progression.ts`, `missions.ts`, `quests.ts`.
  - Clean Prisma mocks.
- **Criteria**: coverage threshold enforced in CI.

#### 1.6 — GitHub Actions CI
- **Features**: `ci.yml` workflow: install, lint, typecheck, test, build.
- **Files**: `.github/workflows/ci.yml`.
- **Criteria**: each PR goes through CI.

### Phase 1 gatekeeper deliverable
A learner can sign up, log in via cookie, complete the existing `genesis` quest, lose and recover their session cleanly. Green CI on all PRs.

---

## Phase 2 — Academy and administration (weeks 4-10)

### Objective
Allow a non-dev editor to produce pedagogical content. This is the biggest phase.

### Modules

#### 2.1 — Pedagogical data model
- **Features**: `Course`, `Chapter`, `Lesson`, `LessonAsset`, `LessonProgress` models + migrations.
- **Files**: `prisma/schema.prisma`, `prisma/migrations/*`, `src/lib/bitquest/academy.ts` (new functions `getCourseTree`, `getLessonWithProgress`).
- **Dependencies**: phase 1.
- **Criteria**: seed of 1 complete course (e.g. "Bitcoin Fundamentals") with 3 chapters and 6 lessons, displayed via Prisma Studio.

#### 2.2 — Public `/academy` routes
- **Features**:
  - `/academy` (catalog), `/academy/[course]` (summary), `/academy/[course]/[chapter]/[lesson]` (reader).
  - SSR + ISR for SEO.
  - MDX renderer (read-only).
  - Per-lesson progression ("Mark as read" button).
- **Files**: `src/app/(app)/academy/**`.
- **Dependencies**: 2.1.
- **Tests**: reader path → mark as read → persisted progression.

#### 2.3 — Admin shell + guard
- **Features**:
  - Layout `src/app/(admin)/admin/layout.tsx` with `requireRole`.
  - Admin sidebar, entry dashboard.
  - Audit log (`AdminAuditLog` model + middleware that persists each admin mutation).
- **Files**: `src/app/(admin)/admin/**`, `src/lib/bitquest/admin-audit.ts`.
- **Criteria**: an APPRENTICE accessing `/admin` is redirected to 403.

#### 2.4 — Course / Chapter CRUD
- **Features**:
  - React Hook Form + Zod forms.
  - DnD reordering with `@dnd-kit` (already installed).
  - Summary preview.
- **Files**: `src/app/(admin)/admin/courses/**`, `src/app/(admin)/admin/chapters/**`.

#### 2.5 — MDX lesson editor
- **Features**:
  - `@mdxeditor/editor` editor wired for real.
  - Upload of assets (images) to S3-compatible storage (Cloudflare R2 recommended for Africa) or local in dev.
  - Live SSR preview.
  - Simple versioning (draft / published).
- **Files**: `src/app/(admin)/admin/lessons/**`, `src/lib/storage/r2.ts`.
- **Difficulties**: secure the upload (MIME, size, scan).
- **Criteria**: an editor can create a lesson, add an image, preview, publish.

#### 2.6 — Admin Quests / Quiz / Badges
- **Features**: CRUD with specific builder per entity (quiz by type MCQ / MULTI / T-F / LOGIC), badge builder (Lucide icon + condition).
- **Files**: `src/app/(admin)/admin/{quests,quiz,badges}/**`.

#### 2.7 — Admin Users
- **Features**: list, filters, role change, soft delete.
- **Criteria**: operation logged in `AdminAuditLog`.

#### 2.8 — Daily / weekly challenges
- **Features**:
  - `DailyChallenge`, `WeeklyChallenge` models.
  - Cron (Vercel cron or GitHub Actions scheduled) that selects an active challenge.
  - Dashboard UI: "Daily challenge", "Weekly challenge".
- **Files**: new `src/lib/bitquest/challenges.ts`, new route `src/app/api/challenges/**`.

#### 2.9 — Internationalization FR / EN
- **Features**:
  - Activate `next-intl`.
  - Locale middleware.
  - Dictionaries `messages/fr/*.json`, `messages/en/*.json`.
  - Language selector.
  - Multilingual pedagogical content (`_fr`, `_en` fields on `Lesson`, `Quest`).
- **Files**: `src/i18n/*`, `next.config.ts`, `src/app/**`.
- **Difficulties**: touch all existing components (long but systematic).

### Phase 2 gatekeeper deliverable
An editor can create a complete course in the admin (without coding), add an image, set up a quiz, link a quest. A learner navigates the course in FR or EN, follows their progression, completes the quest.

---

## Phase 3 — BitLab integration (weeks 11-12)

### Objective
First mission actually validated by a BitLab action.

### Modules

#### 3.1 — Proof model
- **Features**: `BitLabProof`, `RewardIdempotencyKey`, `missionKind: SIMULATED | BITLAB_PROOF` field on `Quest`.
- **Files**: `prisma/schema.prisma`, migration.

#### 3.2 — `MempoolClient` service
- **Features**: fetch `mempool.space/{network}/api/tx/{txid}`, `.../block/{hash}`, timeouts, retries, `blockstream.info` fallback.
- **Files**: `src/lib/bitlab/mempool.ts`.
- **Tests**: HTTP mock.

#### 3.3 — BOLT11 decoder
- **Features**: choose a lib (`bolt11` npm, `@scure/btc-signer` offers something too), verify amount/description.
- **Files**: `src/lib/bitlab/bolt11.ts`.

#### 3.4 — Challenge/proof routes
- **Features**:
  - `POST /api/bitlab/challenge`: issues a JWT signed HS256 (expiry 1h, nonce).
  - `POST /api/bitlab/proof`: verifies JWT, consumes nonce, verifies proof, grants rewards, marks quest `COMPLETED`.
- **Files**: `src/app/api/bitlab/challenge/route.ts`, `src/app/api/bitlab/proof/route.ts`.
- **Tests**: replay scenarios, expiry, invalid proof, double consumption.

#### 3.5 — Deep-link UI
- **Features**: "Open in BitLab" button in `mission-panel.tsx` for `BITLAB_PROOF` quests. New tab. "Waiting for proof" state.
- **Files**: `src/components/bitquest/mission-panel.tsx`.

#### 3.6 — Learner documentation
- **Files**: `docs/user-guide/mission-bitlab.md` + EN translation.

#### 3.7 — Pilot: convert the `tx-basics` quest
- **Features**: mark `tx-basics.missionKind = BITLAB_PROOF`, configure the exercise (expected testnet address, min amount).

### Phase 3 gatekeeper deliverable
A learner completes the `tx-basics` quest by building a real transaction in BitLab on Testnet4; the quest switches to `COMPLETED` when mempool.space confirms the tx.

---

## Phase 4 — Lightning rewards (weeks 13-18, OPTIONAL)

### Objective
Real "earn" loop: satoshis Testnet distributed by BitQuest.

> This phase requires a product decision and a dedicated security validation. **To be undertaken only if the economic model and governance (who funds the testnet pool?) are decided.**

### Synthetic modules
- LDK or LND node controlled on the BitQuest server side (not in the browser).
- Isolated `LightningRewardService` service.
- `Payout` model + idempotence.
- `LIGHTNING_REWARDS_ENABLED` feature flag.
- Daily / weekly / per IP / per user caps.
- KYC-light (email verification, minimum streak, unlocked quests).
- External security audit before going live.

### Infrastructure delivered (2026-11-14)
- [x] Prisma `LightningReward` model (additive migration
  `20261113180000_add_lightning_reward`).
- [x] `sendReward(userId, invoiceBolt11, context)` helper in
  `src/lib/lightning/rewards.ts` — stacked guards (flag + invoice
  + cap + LND configured + `LND_SEND_REWARDS_LIVE=1` kill-switch).
- [x] Isolated wire layer `src/lib/lightning/rewards-lnd.ts` (POST
  `/v2/router/send`) — mockable in test without touching `node:https`.
- [x] Feature flag `lightning.rewards` seeded OFF by default (prisma
  seed, idempotent upsert).
- [x] 11 unit tests with strict isolation verified: `sendReward`
  **never** mutates `User.sats`, nor creates `WalletTransaction` or
  `UserEvent SATS_EARNED` (manifesto § strict sim/real separation).

### Remaining to deliver phase 4

- [ ] UI: learner page "provide an invoice for reward"
  + network validation matching the quest.
- [ ] Call `sendReward()` when a real-BITLAB_PROOF quest
  completes, gated by `isFeatureEnabled("lightning.rewards", userId)`.
- [ ] Daily / weekly / per-IP caps (reusable Redis sliding window
  middleware).
- [ ] KYC-light (verified email + streak ≥ N + required quests).
- [ ] Admin UI `/admin/lightning-rewards` (list + filters by status).
- [ ] External security audit + ops runbook (macaroon rotation,
  LND balance monitoring, alerting).

### Phase 4 gatekeeper deliverable
A qualified learner receives N Testnet sats on a Lightning invoice they provide, without human intervention, with a complete audit trail.

---

## Phase 5 — Industrialization (weeks 19-21)

### Objective
Ready for a community: monitoring, E2E tests, accessibility, WO locale, pentest.

### Modules

#### 5.1 — Observability
- Sentry (frontend + backend).
- `pino` structured logs.
- Prometheus-compatible metrics.
- `/api/health` health check.

#### 5.2 — Playwright E2E tests
- Scenarios: signup → first quest completed, failed/retaken quiz flow, BitLab mission flow, admin lesson edit flow.

#### 5.3 — a11y audit
- `@axe-core/playwright` on main pages.
- Fixes up to WCAG AA.

#### 5.4 — Wolof locale
- `messages/wo/*.json` (collaboration with a native-speaker contributor).
- Pedagogical content at least for the "Bitcoin Fundamentals" course.

#### 5.5 — External pentest
- Second team. Report. Fixes.

#### 5.6 — Active bug bounty
- Publicly announce, align `SECURITY.md`.

### Phase 5 gatekeeper deliverable
BitQuest in open production, active community, fully operational monitoring.

---

## First tasks to tackle immediately (sprint 1, 5 days)

These are the tasks I recommend starting **as soon as this plan is validated**. They correspond entirely to Phase 0.

| # | Task | Impacted files | Estimate |
|---|---|---|---|
| 1 | Remove `z-ai-web-dev-sdk` and rename `package.json.name` → `bitquest` | `package.json` | 0.5 h |
| 2 | Run `depcheck` and remove truly unused deps (`@dnd-kit` if not used, `next-auth` v4 if going in-house, etc.) | `package.json` | 2 h |
| 3 | Remove `ignoreBuildErrors: true` and fix the TS errors that appear | `next.config.ts`, various | 4-8 h |
| 4 | Fix `vitest.config.ts` (real paths under `src/`) + write the first test on `src/lib/bitquest/progression.ts` | `vitest.config.ts`, `__tests__/setup.ts`, `src/lib/bitquest/progression.test.ts` | 4 h |
| 5 | Remove orphan field `QuizQuestion.quest2` + migration | `prisma/schema.prisma`, new migration | 1 h |
| 6 | Migrate `prisma/schema.prisma` to `postgresql` + create `init` migration + update `.env.example` | `prisma/*`, `.env.example` | 4 h |
| 7 | Clean `src/components/ui/`: remove the 36 non-imported primitives | `src/components/ui/*` | 2 h |
| 8 | Create `.github/workflows/ci.yml` (lint + typecheck + test + build) | `.github/workflows/` | 2 h |
| 9 | Document in the `README.md` the **real** stack (Prisma + Postgres) + mention that sats are educational | `README.md`, `CHANGELOG.md` | 2 h |
| 10 | Comment out `middleware.ts` with an explicit TODO for Phase 1 | `middleware.ts` | 15 min |

**Sprint 1 deliverable**: clean repository, green build, active CI, running tests, Postgres in place, honest documentation.

---

## Governance and tracking

- **Task tracking**: one GitHub issue per module; label `phase/0`, `phase/1`, etc.
- **Review**: weekly review of the roadmap, adjustment of estimates.
- **Architectural decisions**: each significant decision documented in `docs/adr/NNNN-title.md` (Architecture Decision Record).
- **Product communication**: before Phase 2, publicly announce that the BitLab integration is "in progress" (don't let the current README lie on this point).

---

## Transverse hypotheses and risks

- **Hypothesis 1**: we keep Prisma (vs. Drizzle). If this decision is reversed, plan for +3 weeks for the ORM migration.
- **Hypothesis 2**: BitLab is modifiable for Phase 3 (deep-link + proof hook). If not, switch to the degraded "copy-paste" alternative of option B (see `BITQUEST_INTEGRATION_BITLAB.md` §8).
- **Hypothesis 3**: target hosting decided before Phase 2 (Vercel? Railway? self-hosted? impact on Redis, S3, cron).
- **Hypothesis 4**: human budget of a full-time senior full-stack dev. Any variation (part-time, in pairs) requires rescheduling.
- **Hypothesis 5**: no major product pivot. If Nostr, formal certification or marketplace are prioritized (see Manifesto), these are dedicated 4+ phases.

---

**Written on**: 2026-11-09
**Next**: execute Phase 0 and revalidate the plan after each gatekeeper milestone.
