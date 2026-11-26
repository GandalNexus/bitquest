# Target BitQuest architecture — 2026-11-09

> Proposed **target** functional and technical architecture, derived from the specifications (`../cdc-bitquest.pdf`) and the manifesto (`../gandalnexus-manifesto.pdf`), aligned with the existing codebase audited in `BITQUEST_AUDIT.md`. The goal is to **preserve the business core already written** and to **build around it** the missing bricks.

---

## 1. Guiding principles

1. **Keep Prisma, migrate to PostgreSQL.** Prisma is already integrated, the specs want Postgres. We keep the ORM in place, we change the data source.
2. **Preserve `src/lib/bitquest/` as the domain layer.** These 7 modules (`client`, `hooks`, `missions`, `progression`, `quests`, `session`, `store`) are the functional core of the product. They must remain the canonical entry point.
3. **Scale up security progressively.** We start from a `localStorage` + token base, we migrate to `httpOnly` cookie + CSRF once the user surface is stabilized. Don't redo everything at once.
4. **BitLab remains master of Bitcoin cryptography.** BitQuest does not handle private keys, does not sign transactions. Practical missions run **in BitLab**, BitQuest verifies a public proof (txid, BOLT11).
5. **Moderate Clean Architecture.** Three clear layers (`domain`, `infrastructure`, `presentation`), without multiplying abstractions. No dogmatic "clean".
6. **Server Actions + Route Handlers.** Server Actions for mutations triggered from components; Route Handlers for endpoints called in fetch (current SPA) or by BitLab (proofs).
7. **Systematic Zod validation at every boundary.** Zod is already installed.
8. **No real Lightning rewards in phase 1.** The "earn" loop will be activated after a dedicated security audit, behind a feature flag.

---

## 2. Layer overview

```
┌───────────────────────────────────────────────────────────────┐
│  PRESENTATION  (src/app, src/components)                      │
│  - App Router pages (/, /academy, /quests, /admin, /profile)  │
│  - UI components (shadcn/ui, dashboard, quest-player)         │
│  - Client hooks (useMe, useQuests via TanStack Query)         │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  APPLICATION  (src/app/api, src/app/actions, src/lib/auth)    │
│  - Route Handlers (REST)                                      │
│  - Server Actions (mutations)                                 │
│  - Auth middleware (next-auth v5 or hardened in-house)        │
│  - Zod validation, rate limiting, role-based authorization    │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  DOMAIN  (src/lib/bitquest)                                   │
│  - Progression engine (XP, levels, streak, sats, badges)      │
│  - Mission engine (generate / validate 8 types)               │
│  - Quest state machine                                        │
│  - Reward engine (daily cap, streak bonus, idempotence)       │
│  - BitLab proof verifier (txid → mempool.space)               │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE  (src/lib/db, src/lib/cache, src/lib/intl)    │
│  - Prisma client (Postgres)                                   │
│  - Redis cache (rate limit, idempotency keys)                 │
│  - i18n next-intl                                             │
│  - Mempool.space client (BitLab proof verification)           │
│  - BitLab bridge (postMessage / JWT)                          │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. Target data model

### 3.1 Incremental evolution of the Prisma schema

We keep the 8 current models and add a pedagogical layer above `Quest`, as well as the bricks needed for admin, i18n, periodic challenges, and the BitLab bridge.

**New models:**

| Model | Role | Key relations |
|---|---|---|
| `Course` | Learning path (e.g. "Bitcoin Fundamentals") | `chapters[]` |
| `Chapter` | Chapter of a course (e.g. "Digital property") | `course`, `lessons[]`, `quests[]` |
| `Lesson` | Atomic MDX lesson with objectives, prerequisites | `chapter`, `assets[]` |
| `LessonAsset` | Image / diagram / video linked to a lesson | `lesson`, `type`, `url` |
| `LessonProgress` | State per user × lesson | `user`, `lesson`, `completedAt` |
| `Role` (enum) | `APPRENTICE`, `EDITOR`, `ADMIN` | added to `User.role` |
| `AdminAuditLog` | Logging of admin operations | `actor`, `entity`, `action`, `before`, `after` |
| `DailyChallenge` | Daily challenge | `date`, `questCode`, `xpBonus` |
| `WeeklyChallenge` | Weekly challenge | `weekStart`, `requirement`, `reward` |
| `RewardIdempotencyKey` | Reward idempotency key | `key` unique, `grantedAt` |
| `BitLabProof` | BitLab action proof | `user`, `questId`, `kind` (TXID / BOLT11 / NODE_ID), `value`, `verifiedAt`, `network` |
| `LocaleString` | Translation (if we externalize content) | `key`, `locale`, `value` |

**Additions to existing models:**

- `User`: `role Role @default(APPRENTICE)`, `preferredLocale String @default("fr")`, `nostrPubkey String? @unique`, `deletedAt DateTime?`.
- `Quest`: `chapterId String?` (optional for SPECIAL outside of curriculum), `estimatedMinutes Int`, `publishedAt DateTime?`, `theorySectionsRich Json` (once on Postgres, native `Json` type).
- `QuizQuestion`: removal of the orphan `quest2` field. Added extended `type` enum: `MCQ | MULTI | TRUE_FALSE | LOGIC`.

### 3.2 Indexes to add

- `UserQuestProgress(userId)`, `UserQuestProgress(status)`.
- `WalletTransaction(userId, createdAt)`.
- `UserEvent(userId, createdAt)`.
- `Quest(track, order)`.
- `BitLabProof(user, questId)`.

### 3.3 SQLite → PostgreSQL migration

Three steps:
1. **Freeze SQLite.** Snapshot the current `db/custom.db` (for possible rollback).
2. **Generate an initial Postgres migration** from the current schema: `prisma migrate dev --name init`. Also solves the "no versioned migrations" problem.
3. **Convert stringified JSON fields to native `Json`** in a second migration.

`docker-compose.yml` is already configured for Postgres 16 — we use it as-is in dev.

---

## 4. Authentication and sessions

### Phase 1 (short term — preserve the existing, harden)

- Keep `scrypt` + random token on the server side.
- **Replace `localStorage` with a `httpOnly; Secure; SameSite=Lax` cookie.** The `middleware.ts` middleware then becomes operational. The API route reads the cookie and no longer custom headers.
- Add a **CSRF token** in a readable cookie, verified on mutations.
- Validate all input via Zod (dedicated schema per route).
- Introduce a `User.role` field and a `requireRole("ADMIN")` helper used by all sensitive routes.
- Persistent rate limiting via Redis (Upstash in prod, local image in dev).

### Phase 2 (medium term — if we target OAuth / Nostr)

- Introduce **NextAuth v5** (or Auth.js): already in dependency in `package.json` (next-auth v4 to be updated). Providers: credentials (current), Nostr NIP-07, email magic link.
- **Guest mode** preserved — anonymous session, purgeable data.
- **Two overlapping sessions** possible: anonymous learner who "upgrades" later to a permanent account without losing their progression.

### Phase 3 (long term — BitLab integration)

- BitQuest → BitLab identity sharing via **short-lived JWT signed by BitQuest** passed in query string during deep-link. BitLab does not authenticate, it simply transmits this ID in the returned proof.

---

## 5. Business logic (domain layer)

### 5.1 Progression engine (existing to preserve)

- `awardXp(userId, amount, source)` remains the unique function of XP assignment.
- `awardSats(userId, amount, streak, questTitle)` same.
- `evaluateBadges(userId)` remains the central evaluator, called after each impactful action.
- **Idempotence**: add an optional `idempotencyKey` parameter that prevents double assignment (e.g. two concurrent network calls on `mission_submit`).

### 5.2 Mission engine

- Keep `generateMission` / `validateMission` for **simulated missions** (phase 1 — already functional).
- Add in phase 2 a second mission type: **BitLab mission**, whose validation no longer goes through an "expected == answer" comparison but through **public proof verification**:
  - `verifyTxid(network, txid, criteria)` → request `mempool.space/{network}/api/tx/{txid}`.
  - `verifyBolt11(network, bolt11, criteria)` → `bolt11` decoding + amount/description verification.
  - `verifyNodeOpened(network, channelOutpoint)` → optional.
- A `missionType` is now `SIMULATED` or `BITLAB_PROOF`.

### 5.3 Reward engine

- Phase 1: identical to the existing (`User.sats` counter).
- Phase 2 (optional, with feature flag): **Lightning testnet reward** driven by a `LightningRewardService` service that talks to a server-controlled LDK node (never in the browser). Separate reserve, caps per user (10k sats/day, 50k sats/month), KYC-light (email verification + minimum streak).
- **No private key on the server side.** If we choose a custodial model, the key is stored in a cloud HSM / KMS. Decision to be made before implementation.

### 5.4 Quest state machine

Current state machine (`AVAILABLE → IN_PROGRESS → THEORY_DONE → QUIZ_PASSED → COMPLETED`) → preserved.

Additions:
- `COMPLETED → MASTERED` transition after N perfect re-completions (optional).
- Explicit transition to `LOCKED` for quests whose prerequisite has been removed (admin).

---

## 6. Frontend

### 6.1 From single-page SPA to real App Router pages

Currently `src/app/page.tsx` does everything. We move to:

```
src/app/
├─ (public)/
│  ├─ page.tsx                   # Landing
│  ├─ login/
│  ├─ signup/
│  └─ about/
├─ (app)/
│  ├─ layout.tsx                 # Authenticated shell
│  ├─ dashboard/
│  ├─ academy/
│  │  ├─ page.tsx                # Course listing
│  │  └─ [courseSlug]/
│  │     └─ [chapterSlug]/
│  │        └─ [lessonSlug]/     # Lesson player
│  ├─ quests/
│  │  ├─ page.tsx                # Quest map
│  │  └─ [code]/
│  │     └─ page.tsx             # Quest player (SSR, SEO)
│  ├─ wallet/
│  ├─ leaderboard/
│  └─ profile/
├─ (admin)/
│  └─ admin/
│     ├─ layout.tsx              # Guard requireRole("ADMIN|EDITOR")
│     ├─ courses/
│     ├─ chapters/
│     ├─ lessons/
│     ├─ quests/
│     ├─ badges/
│     ├─ users/
│     ├─ audit-log/
│     └─ dashboard/
└─ api/
   ├─ auth/                      # hardened existing
   ├─ me/, wallet/, leaderboard/ # existing
   ├─ quests/[code]/progress/    # existing
   ├─ academy/                   # new
   ├─ admin/                     # new, requireRole protected
   └─ bitlab/
      ├─ challenge/              # issue a challenge JWT
      └─ proof/                  # receive proof + verify
```

**Benefits**: shareable URLs, SSR for course SEO, natural code-split cutting, better back/forward navigation.

### 6.2 Components

- Keep the 10 current business components in `src/components/bitquest/`.
- Clean up the 36 unused shadcn/ui primitives.
- Introduce an **MDX Content Renderer** (`<LessonContent />`) using `@mdxeditor/editor` in editor mode in the admin, and `react-markdown` + MDX plugin in learner reading mode.
- **Accessibility**: systematic a11y audit on each component, `jest-axe` or `@axe-core/react` tests.

### 6.3 State management

- Keep Zustand for **session** and **theme**.
- Keep TanStack Query for **API cache**.
- Remove SPA navigation (now handled by the router).
- Zustand store becomes much lighter: just `{ user, csrfToken }` hydrated on boot via a `GET /api/me` endpoint.

---

## 7. i18n

- Activate `next-intl` v4.
- Structure `messages/{locale}/{namespace}.json` with namespaces: `common`, `landing`, `academy`, `quest`, `admin`, `errors`.
- 3 target locales: `fr` (default), `en`, `wo` (wolof, progressive).
- Add a locale middleware + a selector in the shell.
- **Pedagogical content**: translated via a `LocaleString` model or via `title_fr`, `title_en`, `title_wo` fields on `Quest` / `Lesson`. **Recommendation**: typed fields per locale (simpler in Prisma, more readable).

---

## 8. Admin

### 8.1 Authentication

- Guard `requireRole("ADMIN" | "EDITOR")` on `/admin/*`.
- Route `POST /api/admin/promote` reserved for ADMIN, logged in `AdminAuditLog`.

### 8.2 CRUD covered

| Entity | CRUD | Specific editor |
|---|---|---|
| Course | Yes | Simple |
| Chapter | Yes | Simple + DnD reordering (`@dnd-kit` already installed) |
| Lesson | Yes | **MDX Editor** (`@mdxeditor/editor`), asset upload to S3/R2, SSR preview |
| Quest | Yes | Builder: intro + theorySections + missionType + missionConfig |
| QuizQuestion | Yes | Form per type (MCQ, MULTI, TRUE_FALSE, LOGIC) |
| Badge | Yes | Lucide icon selector |
| User | Read + roles | Cannot delete, soft delete (`deletedAt`) |
| DailyChallenge | Yes | Calendar |
| WeeklyChallenge | Yes | Weekly calendar |
| AuditLog | Read-only | Filters by actor / action / entity |

### 8.3 Admin dashboard

- Global stats (DAU, quests completed / day, sats distributed / day).
- Abuse alert (users with > 10 missions completed in 1h, etc.).
- CSV export.

---

## 9. BitLab integration (summary — details in `BITQUEST_INTEGRATION_BITLAB.md`)

Chosen approach: **Deep-link + JWT challenge/response + server-side validation**.

1. BitQuest issues a `MissionChallenge` (signed JWT, expiry 1h, contains `userId`, `questCode`, `requiredAction`, `network`).
2. Deep-link `https://bitlab.gandalnexus.io/?mission=<missionId>&challenge=<jwt>&returnTo=<url>`.
3. BitLab reads the challenge, preloads the appropriate UI (tx-builder, lightning…), **executes nothing confidential**.
4. The user acts (builds a tx, opens a channel, mines a regtest block…).
5. BitLab returns a proof: `txid` / `bolt11` / `blockHash` via `postMessage` or redirect.
6. BitQuest verifies the proof server-side against mempool.space (or bolt11-decoder library) and marks the quest `COMPLETED`.
7. Proof persisted in `BitLabProof`.

**Benefits**: zero private key crosses the two apps, no complex SSO, independent validation.

---

## 10. Observability and operations

- **Structured logs**: `pino` on server side, JSON logs.
- **Errors**: Sentry (self-hosted or cloud) — plan to be decided.
- **Metrics**: `/api/metrics` Prometheus-compatible endpoint.
- **Health checks**: `/api/health` (DB + Redis).
- **Backups**: daily Postgres snapshot, 7-day retention.

---

## 11. Software quality

| Practice | Tool | Status |
|---|---|---|
| TS/JS lint | `oxlint` + `eslint` | ✅ Already configured |
| Format | `prettier` | ✅ Already configured |
| Type check | `tsc --noEmit` | ❌ Not wired, `ignoreBuildErrors: true` to be removed |
| Unit tests | `vitest` | ⚠️ Config to fix + write |
| E2E tests | `playwright` | ❌ To introduce |
| a11y tests | `@axe-core/playwright` | ❌ To introduce |
| CI | GitHub Actions | ❓ `.github/` present, to check |
| Pre-commit | `lefthook` or `husky` + `lint-staged` | ❌ To introduce |
| Code coverage | Codecov or local | ❌ To introduce |

---

## 12. Security (phased consolidation)

**Phase 1 (immediate)**:
- `httpOnly` cookie + CSRF.
- Zod everywhere.
- Disable `ignoreBuildErrors`.
- Redis rate limit.
- Dependency audit (`npm audit`, `snyk`).

**Phase 2 (BitLab reward)**:
- Setup of the isolated `LightningRewardService`.
- Double validation (mempool proof + server signature before reward mint).
- Daily / weekly / per IP / per user caps.
- Abuse detection (light ML or simple rules: < X min between 2 quests = suspicion).

**Phase 3 (industrialization)**:
- External pentest.
- Bug bounty program (already announced in `SECURITY.md`, to activate).
- Secret rotation.

---

## 13. Compliance with the specifications

| Spec requirement | Target phase | Architecture mapping |
|---|---|---|
| §2.1 Accounts (email, Nostr, wallet, guest) | 1 + 2 | Phase 1: email + guest. Phase 2: Nostr via NextAuth v5 |
| §2.2 Quests (intro / theory / mini-quiz / BitLab mission / validation) | 1 + 3 | Phase 1: simulation. Phase 3: BitLab proof |
| §2.3 XP, levels, badges | ✅ already done | Preserve existing |
| §2.4 Quiz (MCQ, T/F, logic) | 2 | Extend `QuizQuestion.type` + UI |
| §2.5 BitLab integration | 3 | Section 9 above |
| §2.6 Educational Lightning wallet | 2 or 3 | Feature flag, dedicated service |
| §3.1 Stack (Drizzle, Postgres) | Partial | **We keep Prisma**, we migrate to Postgres |
| §3.2 Business logic | ✅ existing | Preserve |
| §3.3 WebLN + rate limit | 3 | Phase 3 |
| §4 Security | 1 to 3 | Section 12 |
| §5 UI/UX | 1 | App Router pages, i18n, a11y |
| §6 Future evolutions (leaderboards, Nostr, certifications) | 2 and beyond | Planned in the model |
| §7 RPG Vision | Transverse | Preserve the playful tone of the existing |

**Assumed disagreement with the specs**: Prisma is preferred over Drizzle. Rationale: Prisma is already integrated end-to-end, removing it represents several weeks of risky work without business benefit. If this decision is refused, an ORM change must be tracked as a separate project in the roadmap.

---

## 14. Architectural decisions to validate

1. **Prisma kept** (vs. Drizzle migration).
2. **Postgres via Docker in dev**, serverless hosting in prod to be defined (Neon, Supabase, Railway…).
3. **Two separate domains** `bitquest.gandalnexus.io` and `bitlab.gandalnexus.io`, no monorepo at first.
4. **No real Lightning rewards in phase 1.**
5. **Content i18n** via typed locale fields (`title_fr`, `title_en`) rather than `LocaleString` table — simpler, fewer joins.
6. **Monorepo deferred.** To be re-evaluated after the joint BitQuest + BitLab production launch.

---

**Written on**: 2026-11-09
**Next deliverable**: `BITQUEST_FEATURE_MATRIX.md`
