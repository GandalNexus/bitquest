# BitQuest Audit — 2026-11-09

> Official audit report, based on the actual state of the code at commit `95c1fdf` and on the full reading of the specifications (`../cdc-bitquest.pdf`) and the manifesto (`../gandalnexus-manifesto.pdf`). All statements are backed by a file:line path.

---

## 1. Executive summary

BitQuest is a Next.js 16 / React 19 / Prisma / SQLite project **actually functional** on its main path (signup → quest path → quiz → simulated mission → XP/sats/badges), but **clearly below the specifications** on several structural axes:

- **ORM & DB announced in the documentation ≠ actual ORM & DB.** The `README.md` and `CHANGELOG.md` promise Drizzle + PostgreSQL; the code uses Prisma 6.11 + **SQLite** (`prisma/schema.prisma:5-8`, `src/lib/db.ts:1-13`), and the database file is stored in plaintext under `db/custom.db`.
- **No real integration with BitLab.** The 8 "BitLab" missions are **entirely simulated on the server side** (`src/lib/bitquest/missions.ts`, 568 lines). No HTTP call, deep-link, postMessage, WebLN or LDK. The term "BitLab" is only present in interface text.
- **No real satoshi is at stake.** Sats are an integer `User.sats` incremented in database (`prisma/schema.prisma:19`); no wallet, no BOLT11, no chain-side rate-limiting. Consistent with the educational nature but to be clarified in the product messaging.
- **"dev-only" authentication.** Sessions via `x-gn-user-id` + `x-gn-token` read in `localStorage` (no `httpOnly` cookie, no JWT, no CSRF). Hashing via `crypto.scryptSync` (acceptable) but without adaptive parameterization.
- **Zero executable tests.** `vitest.config.ts` points to `app/actions/**`, `db/**`, `middleware.ts` — paths that don't exist in this project, which is entirely under `src/`. No `*.test.ts` in the repository.
- **Zero admin interface.** No `/admin` route, no role, no CRUD for courses/quests/badges/quiz.
- **i18n not activated.** `next-intl@4.3.4` is present in `package.json:66` but is imported nowhere — all content is hardcoded in French.
- **"Template" debt.** Package named `nextjs_tailwind_shadcn_ts` (`package.json:2`), `z-ai-web-dev-sdk` dependency never imported, 36 orphan `shadcn/ui` components, `next.config.ts:7` forces `ignoreBuildErrors: true`.

Despite this, the business core (progression, mission engine, badge engine, XP/level/streak calculation) is **polished, isolated in `src/lib/bitquest/`, testable, and of good quality**. The refactor must **preserve this base** and not start from scratch.

---

## 2. Scope and method

- Exhaustive reading: `README.md`, `CHANGELOG.md`, `AUTHORS.md`, `SECURITY.md`, `package.json`, `tsconfig.json`, `next.config.ts`, `middleware.ts`, `drizzle.config.ts`, `docker-compose.yml`, `.env.example`, `prisma/schema.prisma`, `vitest.config.ts`.
- Systematic exploration of `src/app/`, `src/components/`, `src/lib/`, `prisma/`, `db/`, `public/`.
- Cross-verification via `grep -r "drizzle|next-auth|next-intl|webln|@scure|lightning"` (7 files touched, all as textual references, no integration).
- Full reading of the critical route `src/app/api/quests/[code]/progress/route.ts` (303 lines).
- Full reading of the files `../cdc-bitquest.pdf` (4 pages) and `../gandalnexus-manifesto.pdf` (2 pages).
- **Out of scope**: BitLab (`../bitlab/`), analyzed separately in `BITQUEST_INTEGRATION_BITLAB.md`.

---

## 3. Stack actually in place

| Layer | Announced (README/specs) | Actual |
|---|---|---|
| Framework | Next.js 14+ (App Router) | **Next.js 16.1.1** (`package.json:64`) |
| Language | Strict TypeScript | TS 5 strict (`tsconfig.json:7`), but `noImplicitAny: false` (line 9) and `next.config.ts:7`: `ignoreBuildErrors: true` — **typing is not really enforced at build** |
| UI | Tailwind + shadcn/ui | ✅ Tailwind 4, 48 shadcn primitives (of which **36 unused**) |
| Client state | Zustand | ✅ Zustand 5 (`src/lib/bitquest/store.ts`) + TanStack Query 5 (`src/lib/bitquest/hooks.ts`) |
| ORM | Drizzle | ❌ **Prisma 6.11** (`src/lib/db.ts`, `prisma/schema.prisma`) |
| DB | Serverless PostgreSQL | ❌ **SQLite** (`prisma/schema.prisma:6`). Local file: `db/custom.db` |
| Auth | NextAuth cited in deps | ❌ Not used. In-house auth `scrypt` + localStorage token |
| i18n | next-intl | ❌ Dependency installed, zero imports |
| Tests | Vitest configured | ⚠️ Config present, **pointed to nonexistent paths**, zero tests |
| Deployment | `output: "standalone"` + Caddyfile | ✅ Configured (`next.config.ts:4`) |

**"Heavy" dependencies present in `package.json` but without known usage:**
- `next-auth@4.24.11` (line 65) — zero imports
- `next-intl@4.3.4` (line 66) — zero imports
- `@mdxeditor/editor@3.39.1` (line 24) — zero imports (editor never wired)
- `@dnd-kit/*` (lines 20-22) — zero imports
- `z-ai-web-dev-sdk@0.0.18` (line 83) — signature of an AI template, **to be removed**
- `react-markdown`, `react-syntax-highlighter`, `embla-carousel-react`, `recharts`, `input-otp`, `react-resizable-panels`, `vaul` — to be checked case by case during cleanup.

---

## 4. Data model (Prisma / SQLite)

8 models, all persisted in SQLite. Each JSON field is stored as `String` (SQLite constraint, no native `Json` type).

| Model | Role | Functional key | Remarks |
|---|---|---|---|
| `User` | Learner account | `pseudo` unique, `token` unique | `isGuest` / `isBot` coexist; no admin `role` |
| `Quest` | Quest definition | `code` unique, `track`, `order` | `theorySections` and `missionConfig` are stringified JSON |
| `QuizQuestion` | Quiz question | `questId`, `order` | **Orphan `quest2: String?` field** (`prisma/schema.prisma:62`) — dead migration remnant |
| `UserQuestProgress` | State per user×quest | `@@unique([userId, questId])` | Stores `missionSession` (challenge + expected) and `missionProof` as JSON |
| `Badge` | Badge catalog | `code`, `rarity`, `conditionType`, `conditionValue` | 7 condition types, server-side evaluation |
| `UserBadge` | Assignment | `@@id([userId, badgeId])` | OK |
| `WalletTransaction` | Sats history | `type` (QUEST_REWARD / STREAK_BONUS / DAILY_CAP) | One-directional: no spending |
| `UserEvent` | User timeline | `type` (5 values), `payload` JSON | Feeds the dashboard |

**Identified problems:**
- **No versioned migrations.** No `prisma/migrations/` folder. The `db:push --accept-data-loss` script is run in dev; in production this flag is unacceptable.
- **`db/custom.db` is committable.** The `.gitignore` does ignore `*.db`, but the file exists locally and may leak if someone force-commits.
- **No performance indexes** beyond uniqueness. `UserQuestProgress.userId`, `WalletTransaction.userId`, `UserEvent.userId` will be read very often — an explicit index would speed things up and prepare for the Postgres migration.
- **Stringified JSON types.** Acceptable for SQLite; to be converted to native `Json` during the Postgres migration.

---

## 5. Authentication and sessions

**Central file**: `src/app/api/auth/route.ts` (113 lines).

- Signup (`action: "register"`): `pseudo` 3–20 chars validation, simple email regex `^\S+@\S+\.\S+$`, 6+ chars password (**too weak**). Hashing via `crypto.scryptSync` + 16-byte salt. Token = 32 random bytes.
- Login (`action: "login"`): `crypto.timingSafeEqual` verification (good).
- Guest (`action: "guest"`): rate-limited in memory to 10/min/IP via `src/lib/bitquest/session.ts`.
- **Session transport**: client stores `{ userId, token }` in `localStorage` (key `bitquest_session`), then `fetch` adds two custom headers `x-gn-user-id` and `x-gn-token` (`src/lib/bitquest/client.ts`).
- **Middleware** (`middleware.ts:15`): reads a `user_session` cookie that is **never defined by the code** server-side. **Route protection is therefore inoperative** — anyone can type `/dashboard` without a cookie and the middleware will let them through... except it redirects when the cookie is missing. **Contradiction**: the session is in `localStorage`, not in a cookie, so the authenticated user is redirected to `/login` anyway. To check: there is in practice **only one SPA page** (`src/app/page.tsx`), so the inconsistency is hidden but **the middleware is to be rewritten**.
- **Roles**: none (`User` has no `role` field).
- **CSRF**: not present — acceptable as long as the session is outside a cookie (so not targetable by classic CSRF), but to be revisited if we switch to an `httpOnly` cookie.
- **Rate limiting**: implemented in memory (`src/lib/bitquest/session.ts:19`) — **reset on each restart, ineffective in multi-instance**.

---

## 6. Pedagogical module (quests)

- **11 seed quests** entirely written in French (`src/lib/seed-data.ts`, 800+ lines): 3 INITIATION, 2 INTERMEDIATE, the rest spread over ADVANCED and SPECIAL.
- Quest structure: `intro` + `theorySections` (JSON array of 3 sections `{title, body, keypoints}`) + 4 `QuizQuestion` + `missionType` + `missionConfig`.
- **No multimedia content stored** (images, videos, diagrams). The specs require illustrations; currently only text.
- **Unlocking**: `src/lib/bitquest/quests.ts` applies a double rule (required level + previous quest completed on the same track). Functional.
- **Persisted progression**: yes, via `UserQuestProgress` (statuses AVAILABLE / IN_PROGRESS / THEORY_DONE / QUIZ_PASSED / COMPLETED).
- **Transversal pedagogical prerequisites** (e.g. "complete the INITIATION track before any SPECIAL quest"): not modeled.
- **Content editor**: absent. `@mdxeditor/editor` is installed but not wired. Content is modified solely by editing the TypeScript seed.

---

## 7. Quiz and evaluations

- Supported types: `MCQ` (single choice among N) and `TRUE_FALSE`. **No multiple-answer question**, **no open-ended question**, **no conditional "Bitcoin logic" validation** as mentioned in specs §2.4.
- Grading: **100% server-side** (`src/app/api/quests/[code]/progress/route.ts:109-125`). The client receives the score and the explanations per question.
- Passing threshold: 70% (`src/lib/bitquest/progression.ts` via `QUIZ_PASS_THRESHOLD`).
- History: `quizAttempts`, `quizBestScore`, `perfectQuiz` stored in `UserQuestProgress`.
- **No question bank / randomization** — the 4 questions are fixed per quest.

---

## 8. "BitLab" missions (actually server simulation)

- **File**: `src/lib/bitquest/missions.ts` (568 lines), 2 main functions: `generateMission(type, config)` and `validateMission(type, session, answer)`.
- **8 types**: `block_explorer`, `key_forge`, `tx_builder`, `mine_nonce`, `ln_channel`, `ln_invoice`, `multisig_sign`, `taproot_tweak`. Each type has its dedicated UI in `src/components/bitquest/mission-panel.tsx`.
- **"Challenge + expected" model**: the server generates a challenge, stores the expected in `UserQuestProgress.missionSession` and compares the client's response. **The proof is forged server-side** and stored in `missionProof`.
- **None of this touches a real blockchain, a real Lightning node, a real LDK.** The BOLT11s displayed are synthetic strings. It's a well-designed pedagogical simulator, but **absolutely not to be presented as a BitLab integration**.
- **Mission rate limiting**: 100 req/min per user via `rateLimit("progress:...")` + `MISSION_MAX_ATTEMPTS` per quest.

---

## 9. Gamification

**Central engine**: `src/lib/bitquest/progression.ts` (239 lines).

- **XP**: 4 sources (THEORY_SECTION = 5, QUIZ_PASS = 30, MISSION_SUCCESS = 50, QUEST_BONUS = 20).
- **Levels**: 10 tiers `[0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200]`. Fixed titles "Novice de la Genèse" → "Maître Satoshi".
- **Streak**: `User.streak` + `User.lastActiveDate`. Logic: +1 if activity yesterday, reset to 1 otherwise.
- **Sats**: daily cap `SATS_DAILY_CAP = 10000`, streak bonus from 0 to 50% (10% per day). `awardSats()` inserts 1 or 2 `WalletTransaction`.
- **Badges**: 15 in seed, automatic evaluation by `evaluateBadges(userId)` after each impactful action. 7 conditions: `QUEST_COMPLETE`, `QUEST_COUNT`, `TRACK_COMPLETE`, `STREAK`, `LEVEL`, `SATS_TOTAL`, `PERFECT_QUIZ`.
- **Leaderboards**: route `GET /api/leaderboard` — top 20 by XP (`src/app/api/leaderboard/route.ts`).
- **Daily/weekly challenges**: **not implemented** — the specs mention them, the code does not model them.
- **Reward history**: yes (`WalletTransaction` + `UserEvent`).

---

## 10. Bitcoin / Lightning rewards

- **Real Lightning: zero.** No lib installed (no `@scure/*`, no `lightning`, no `webln`, no `ldk`).
- **WebLN: zero.** No `window.webln`.
- **Chain-side rate limiting: not applicable** (there is no chain).
- **Protection against double rewards**: yes at the application level — `progress.ts:236` checks `if (!p.missionProof)` before assigning the mission XP, and `wasCompleted` prevents double assignment of the completion bonus and sats.
- **Secure architecture for real sats**: **to be designed entirely.** No brick exists.

---

## 11. Administration

- **No `/admin` route.**
- **No user role.**
- **No CRUD UI** for quests, badges, courses, users, events.
- **No logging of admin operations.**
- Content management is done exclusively by editing `src/lib/seed-data.ts` then replaying `prisma/seed.ts`. **Impossible for a non-dev editor to contribute.**

---

## 12. User interface

**UI architecture**: single-page SPA in `src/app/page.tsx` (81 lines) which dispatches to 5 views via the Zustand store.

Business components in `src/components/bitquest/`:
- `app-shell.tsx` (navbar + sidebar)
- `dashboard.tsx` (SVG level ring, stats, 3 suggested quests, timeline)
- `quest-map.tsx` (grid by track)
- `quest-player.tsx` (4-step reader theory → quiz → mission → recap)
- `mission-panel.tsx` (8 UIs according to `missionType`)
- `leaderboard.tsx`, `wallet-view.tsx`, `profile-view.tsx`, `auth-screen.tsx`, `ui-bits.tsx`.

**Strengths**: dark mode via `next-themes`, polished fonts (Orbitron / Exo 2 / Geist Mono), Framer Motion used for transitions and celebrations.

**Weaknesses**:
- All routing is done client-side (`store.view`) → no shareable URL, no SEO, no deep-link to a quest.
- No "mobile-first" mode documented — `hooks/use-mobile.ts` is used but several screens remain dense.
- No verified accessibility (no a11y tests, no systematic ARIA attributes).
- No error / 404 / offline screens.

---

## 13. Internationalization

- `next-intl@4.3.4` installed, **never imported**.
- No `messages/` folder, no dedicated `next.config` configuration.
- All user text is hardcoded in French.
- The specs plan FR + EN + Wolof. **To be built entirely.**

---

## 14. Tests

- `vitest.config.ts`: coverage pointed to `app/actions/**`, `db/**`, `middleware.ts` — **the project has no `app/actions` folder** (everything is under `src/app/`), the `db/` folder contains only `custom.db`, and `middleware.ts` is at the root. **Obsolete configuration, probably copied from a template.**
- `__tests__/setup.ts` referenced as `setupFiles`: **the `__tests__` folder does not exist**.
- No `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx` file in the repository.
- Recent commits (`3aadd0a test: add comprehensive stress test suite for auth and quests`) suggest a test suite existed then was **deleted by the commit `a2d7ad9 refactor: add new codebase`**. To be confirmed by `git log --diff-filter=D`.

---

## 15. Security

| Theme | State | Verdict |
|---|---|---|
| Password hash | `scryptSync` + 16b salt | ✅ Correct |
| Comparison | `timingSafeEqual` | ✅ Correct |
| Session transport | `localStorage` + custom headers | ⚠️ No `httpOnly`, vulnerable to XSS |
| CSRF | Absent | ⚠️ Not required as long as no cookie, to plan otherwise |
| Input validation | Manual, no Zod | ⚠️ Zod installed but not used |
| Rate limiting | In RAM | ⚠️ Not viable in production |
| Secrets | `.env.example` without secret | ✅ No leak |
| API permissions | Authentication only, no granular authorization | ⚠️ No role |
| SQL injection | Parameterized Prisma | ✅ Safe |
| XSS protection | React (auto-escaping) | ✅ By default |
| `JSON.parse` on stored fields | Not sanitized | ⚠️ Low risk (data controlled by seed) |
| Bitcoin secrets on server side | No key | ✅ Compliant with specs §4 |

---

## 16. Deployment and DevOps

- `next.config.ts`: `output: "standalone"` ✅ + `ignoreBuildErrors: true` ❌.
- `Caddyfile` present (reverse proxy) — to be audited separately.
- `docker-compose.yml` declares Postgres 16 — **inconsistent** with `prisma/schema.prisma` which uses SQLite.
- `.github/` exists — workflows to be inventoried.
- `oxlint` + `eslint` + `prettier` + `prettier-plugin` configured. Static quality OK.
- No visible CI that lints/type-checks/tests.

---

## 17. What is **actually** functional, to preserve

1. **Progression engine** (`src/lib/bitquest/progression.ts`) — XP, level, streak, sats, badges.
2. **Simulated mission engine** (`src/lib/bitquest/missions.ts`) — 8 types, server-side generation & validation.
3. **Progression route** (`src/app/api/quests/[code]/progress/route.ts`) — full management of the 5 actions, idempotence on rewards.
4. **Pedagogical seed** (`src/lib/seed-data.ts`) — 11 well-written quests in French.
5. **Dashboard + level ring** — polished UX.
6. **Zustand + TanStack Query** — healthy client stack.
7. **Dark mode + fonts** — consistent visual identity.

## 18. What is **missing** or **defective**, in order of urgency

### Critical (blocks the "reference platform" target)
- Full admin (CRUD quests, courses, chapters, quiz, badges, users, events).
- User roles (admin / editor / learner).
- Course / Chapter / Lesson model (the specs imply a hierarchical structure above the Quest, currently absent).
- Real BitLab integration (see `BITQUEST_INTEGRATION_BITLAB.md`).
- Tests (at least unit on `progression.ts` and `missions.ts`, E2E on the quest path).
- i18n FR/EN (then WO).

### Strong
- Migration to PostgreSQL and versioned Prisma migrations.
- `httpOnly` cookie session + CSRF.
- Persistent rate limiting (Redis / DB).
- Content editor (MDX already installed).
- Illustrations / multimedia content in the quests.
- Daily / weekly challenges.
- Dedicated pages per view (shareable URLs, SEO, deep-link).

### Medium
- Cleanup of unused dependencies (`next-auth`, `@mdxeditor` if abandoned, `@dnd-kit`, `z-ai-web-dev-sdk`, orphan shadcn components).
- Fix `middleware.ts` (or remove it if we stay SPA).
- `next.config.ts`: disable `ignoreBuildErrors`.
- Missing Prisma indexes.
- Rename `package.json` (currently `nextjs_tailwind_shadcn_ts`) → `bitquest`.
- Cleanup of the orphan `QuizQuestion.quest2` field.

### Low
- Remove `db/custom.db` from tracking (or check `.gitignore`).
- Document the `Caddyfile`.
- Add `/about`, `/privacy`, `/terms` pages.

---

## 19. Major identified risks

1. **Product messaging vs. technical reality.** The README promises a stack (Drizzle / Postgres) that is not that of the code; the specs promise a BitLab integration that does not exist. Risk of loss of trust if an external contributor audits the project.
2. **Silent deletion of tests.** The commit `a2d7ad9 refactor: add new codebase` appears to have replaced the codebase all at once — potentially destructive. To audit (`git show --stat a2d7ad9`).
3. **`z-ai-web-dev-sdk` dependency.** Signature of code generated by a third-party service; check the associated files and remove.
4. **`ignoreBuildErrors: true`.** Masks all TS errors at build. A refactor in production may break silently.
5. **Content management via seed.** Impossible to collaborate with a non-dev editor until there is an admin.

---

## 20. Audit conclusion

BitQuest is **neither a simple quiz**, **nor the platform described in the specifications** — it's a **serious pedagogical MVP with a solid business engine**, but whose "product" layer (admin, dynamic content, i18n, tests, BitLab) and "ops" layer (Postgres, migrations, session security) are not yet built.

The good news: the **business core (`src/lib/bitquest/`) and the seed are of sufficient quality to be preserved** and serve as a foundation for the refactor. The bad: there remain **at least 60 to 80 person-days** of work to achieve the objectives of the specs (see `BITQUEST_ROADMAP.md`).

---

**Written on**: 2026-11-09
**Next deliverable**: `BITQUEST_ARCHITECTURE.md`
