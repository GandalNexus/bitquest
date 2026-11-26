# LOT_1 — Dashboard & Academy — Attack Plan

**Date**: 2026-11-09
**Target branch**: `phase-1-lot-1` (to create after validation)
**Prerequisites**: Phase 0 hygiene completed (commits `34b994b` → `2d2a987`), Docker environment operational.
**Reference**: `docs/BITQUEST_ROADMAP.md` (Phases 1 & 2), `docs/BITQUEST_FEATURE_MATRIX.md`.

---

## 1. Audit of Existing

### 1.1 Dashboard (`src/components/bitquest/dashboard.tsx`, 451 lines)

The dashboard **exists and is functional**. It consists of:

| Block | Content | Status |
|---|---|---|
| **Hero** | Personalized greeting + SVG level ring + XP + XP remaining to next level | Operational |
| **4 StatCards** | Total XP, completed quests (X/Y), unlocked badges, sats balance | Operational |
| **Continue learning** | Smart picker for the next quest (status priority: IN_PROGRESS → THEORY_DONE → QUIZ_PASSED → AVAILABLE), CTA "Start / Resume" | Operational |
| **Progress by track** | 4 progress bars (INITIATION, INTERMEDIATE, ADVANCED, SPECIAL) with done/total counter | Operational |
| **Recent badges** | Last 4 badges with Lucide icon + name + styled rarity | Operational |
| **Recent activity** | Last 8 events (QUEST_COMPLETED, BADGE_UNLOCKED, LEVEL_UP, SATS_EARNED), timeline with icons + relative time (FR) | Operational |
| **Streak footer** | Subtle X-day streak indicator | Operational |

**Reusable components** (in `src/components/bitquest/ui-bits.tsx`):
- `LevelRing`, `StatCard`, `RewardChips`, `BadgeIcon`, `EmptyState`, `ErrorState`, `LoadingState`
- `rarityStyles`, `statusLabels`, `trackStyles` (styles by enum)

**Dependencies**:
- Hooks: `useMe()`, `useQuests()` via TanStack Query (`src/lib/bitquest/hooks.ts`).
- Shell: uses `AppShell` via the parent `src/app/page.tsx`.
- Navigation: `onNavigate(view)` function passed as prop, drives the Zustand store.

**Identified improvement points** (in order of product value):

| # | Improvement | Effort | Impact |
|---|---|---|---|
| D1 | **"Daily challenge" banner** if `DailyChallenge` exists (pending model) | M | High (retention) |
| D2 | **Direct link to Academy** (CTA or tile), currently missing | S | High (learner journey) |
| D3 | **Improved empty state** when `recentEvents.length === 0` for new accounts (with CTA toward first quest) | S | Medium |
| D4 | **Micro-interactions** on StatCard hover (already in Framer Motion, to polish) | S | Low |
| D5 | **"Next lesson" section** on the Academy side (out of scope until models exist) | — | Depends on B1 |
| D6 | **Accessibility**: check `text-muted-foreground` contrast, add `role="region"` on main sections | S | Medium |
| D7 | **Deep-link to a quest** via URL (`/quests/[code]`) instead of SPA store only | L | High (SEO + sharing) |
| D8 | **Loading skeleton** (instead of full-screen `LoadingState`) to avoid flash | M | Medium |

### 1.2 Academy — nonexistent

**Nothing exists** for the Academy:

- No `/academy` route (verified: `ls src/app/` contains only `api/`, `layout.tsx`, `page.tsx`, `global-error.tsx`, `globals.css`).
- No Prisma model for `Course`, `Chapter`, `Lesson` (verified: `prisma/schema.prisma` contains only the 8 current models).
- No client-side component.
- No dedicated API.

The spec and the roadmap (Phase 2) plan for:
- `Course` (thematic path) → contains several `Chapter`
- `Chapter` (e.g. "Digital ownership") → contains several `Lesson` and can link `Quest`
- `Lesson` (MDX content with objectives, prerequisites, assets)
- `LessonProgress` (per user × lesson)
- `LessonAsset` (images, diagrams, videos — via S3/R2 upload)

The current pedagogical content is **entirely contained in the 11 seed quests** (`src/lib/seed-data.ts`, `theorySections` field). The Academy will come to enrich and structure this content on top of the quests.

---

## 2. Guiding Principles of LOT_1

1. **Incremental and testable.** Each sub-task ends with a green `npm run lint && npm run typecheck && npm test` + optionally a manual UI check via Docker.
2. **No regression.** The existing Dashboard remains 100% functional at every step. Improvements D1–D8 are added, not substituted.
3. **No modification of business rules** (`progression.ts`, `missions.ts`, `quests.ts`). Read-only.
4. **No PostgreSQL migration** (stays SQLite for this lot).
5. **The Academy starts with reading** (listing + navigation) — no MDX editor in this lot (that one is in Phase 2 admin).
6. **Zero fictitious data** in the final components. If real data is missing, we don't display rather than invent.
7. **Everything goes through Docker** (`bitquest-dev` container already configured).

---

## 3. Proposed Breakdown — 3 Sequential Sprints

### Sprint 1A — Dashboard: lower-risk improvements (1 day)

**Objective**: make the dashboard more actionable without touching data models.

#### Task D2 — "Academy" tile in the dashboard (shim)
- Add a "Go deeper with the Academy" section, **disabled** (grayed out + "Coming soon" badge) to prepare for Phase 2.
- No target route yet — the CTA is inert at this stage.
- File: `src/components/bitquest/dashboard.tsx` + new sub-component in `ui-bits.tsx`.

#### Task D3 — Enriched empty states
- If `recentEvents.length === 0` AND `completedQuests.length === 0` → display a short onboarding (3 steps: quiz → mission → reward) with CTA "Start the Genesis quest".
- File: `src/components/bitquest/dashboard.tsx`.

#### Task D6 — Dashboard accessibility
- Add `role="region"` + `aria-labelledby` on each section.
- Check contrast of `text-muted-foreground` on cards (manual visual audit).
- Add `aria-live="polite"` on dynamically loaded events.
- File: `src/components/bitquest/dashboard.tsx`.

**Tests added**:
- `src/components/bitquest/__tests__/dashboard.test.tsx` — minimal render with mocked hooks (3-5 tests).

**Acceptance criteria sprint 1A**:
- Tests still at 25+ passing.
- Manual Lighthouse accessibility ≥ 90.
- No regression of the 7 existing blocks.

---

### Sprint 1B — Academy foundations (read-only) (2-3 days)

**Objective**: lay down the data model, create public routes, display a catalog + a placeholder lesson. No editor, no upload.

#### Task B1 — Prisma models
- Add `Course`, `Chapter`, `Lesson`, `LessonProgress` to `prisma/schema.prisma`.
- Relations:
  - `Course 1-n Chapter`
  - `Chapter 1-n Lesson`
  - `Chapter n-n Quest` (optional, via pivot table `ChapterQuest`)
  - `User 1-n LessonProgress`
- Indexes: `Chapter(courseId, order)`, `Lesson(chapterId, order)`, `LessonProgress(userId, lessonId)` (unique composite).
- **DB**: SQLite. Command: `npx prisma db push` (or not, depending on instructions — to validate with the user; I suggest `db push` for this sprint only, documented in the report).
- **Seed**: add 1 course "Bitcoin Fundamentals" × 2 chapters × 3 lessons each, entirely in French. Lesson content can be plain-text Markdown (no advanced MDX).
- Files: `prisma/schema.prisma`, `prisma/seed.ts`, new `src/lib/bitquest/academy.ts` (typed queries).

#### Task B2 — Public API route
- `GET /api/academy/courses` → course list (public, no auth required).
- `GET /api/academy/courses/[slug]` → detail with `chapters[].lessons[]` tree, and for the authenticated user: the `LessonProgress`.
- `POST /api/academy/lessons/[id]/complete` → marks a lesson as read (authenticated).
- Zod validation on params.
- Files: `src/app/api/academy/**/route.ts`.

#### Task B3 — Catalog + reader pages (real App Router pages)
- `src/app/academy/page.tsx` — SSR, course catalog, cards with title, description, number of chapters/lessons.
- `src/app/academy/[courseSlug]/page.tsx` — course summary + progress bar.
- `src/app/academy/[courseSlug]/[chapterSlug]/[lessonSlug]/page.tsx` — lesson reader (Markdown render via `react-markdown`, already in deps).
- Navigation: "Previous / next lesson", "Back to summary".
- "Mark as read" button (calls `POST /complete`, invalidates the TanStack Query cache).
- Files: new files `src/app/academy/**/page.tsx`.

#### Task B4 — Dashboard integration
- Activate the "Academy" tile from D2 with a real link to `/academy`.
- Display the suggested next lesson (first unread in the started course).
- File: `src/components/bitquest/dashboard.tsx`.

**Tests added**:
- `src/lib/bitquest/academy.test.ts` — "next lesson" selection logic (pure function).
- `src/app/api/academy/__tests__/courses.test.ts` — smoke tests with Prisma mock.

**Acceptance criteria sprint 1B**:
- `/academy` shows 1 real seeded course.
- Clicking a course → summary → clicking a lesson → Markdown content displays.
- "Mark as read" persists state.
- Dashboard displays the active Academy tile.
- Tests at 30+ passing.

---

### Sprint 1C — Deep-links & UX hygiene (1-2 days)

**Objective**: exit pure SPA navigation to enable URL sharing (D7).

- `src/app/quests/[code]/page.tsx` — SSR route that mounts the existing `QuestPlayer`.
- Update `QuestMap` to point to `/quests/[code]` instead of calling `openQuest`.
- Keep the Zustand store for session, but progressive removal of `view` (replaced by the router).
- `src/app/wallet/page.tsx`, `/leaderboard`, `/profile` likewise.
- Update `middleware.ts` to protect these new routes (middleware re-activated in Phase 1 security, but we can already arm it in read-mode here).
- Loading skeletons for each page (D8).

**Acceptance criteria sprint 1C**:
- Shareable URL `http://localhost:3000/quests/genesis` works.
- No regression on dashboard or quest player.
- Tests still green.

---

## 4. Risks and Watch Points

| # | Risk | Mitigation |
|---|---|---|
| R1 | Adding Prisma models without `db push` → client doesn't know them | Run `prisma db push --accept-data-loss` on `db/custom.db` (adds columns, no deletion). **To validate with the user first.** |
| R2 | `db push` on an existing dev base could overwrite local data | SQLite adds columns/tables without touching existing ones. Snapshot `db/custom.db` beforehand as a safety net. |
| R3 | Changing routing (sprint 1C) breaks the current Zustand store | Do last, manual tests of each view. |
| R4 | Creating `/academy` public route = premature SEO exposure | Use `robots.txt` or `<meta name="robots" content="noindex">` while content is unvalidated. |
| R5 | Next.js build still broken (pre-existing issue) | Out of scope for this lot, but to fix in parallel. |

---

## 5. Explicit Out-of-Scope for LOT_1

- Admin MDX editor (Phase 2).
- Upload of images / pedagogical assets (Phase 2).
- Multi-locale (FR/EN) for Academy content — everything in French in this lot.
- End-of-track certifications (Phase 2+).
- Dynamic courses via admin (always in seed in this lot).
- Real Lightning (Phase 3+).
- PostgreSQL migration (after Phase 2).

---

## 6. Decisions to Validate Before Coding

1. **Sprint 1A first or directly 1B?** I recommend 1A (low-risk, immediate value, prepares ground for 1B).
2. **Authorization to run `prisma db push --accept-data-loss` on `db/custom.db`** to add Academy tables? (No existing data will be deleted since the tables are new. But it's the first time the Phase 0 "do not touch the database" rule is lifted.)
3. **Slug vs id in URLs** (`/academy/fondamentaux-bitcoin` vs `/academy/clw123...`)? I recommend slug (more readable, SEO).
4. **Markdown or MDX for lessons**? I recommend pure Markdown in this lot (simpler, no need for the Phase 2 MDX editor to read).
5. **Dedicated branch `phase-1-lot-1`** or continue on `phase-0-docker-setup`? I recommend dedicated to isolate.

---

## 7. Expected Deliverable at End of LOT_1

A learner must be able to:
1. Log in.
2. See in their dashboard a clear onboarding + an active Academy tile.
3. Click on the Academy → see a course.
4. Click the course → read a summary and start the first lesson.
5. Read a lesson → mark it as read.
6. See their progress in the dashboard (new "N lessons read" indicator).
7. Share a quest URL (`/quests/genesis`) and access it directly.

All this **without regression** of existing quest paths.

---

**Written on**: 2026-11-09
**Next action**: wait for validation of §6 decisions by Diallo before creating the `phase-1-lot-1` branch and starting sprint 1A.
