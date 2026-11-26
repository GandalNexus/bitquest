# SPRINT_1B — Academy schema + additive migration plan

**Date**: 2026-11-09
**Branch**: `phase-1-lot-1` (continues Sprint 1A, commit `00cce1e`)
**Prerequisites**: Phase 0 + Sprint 1A validated, Docker up, `db/custom.db` intact.

> **No modification of code or database will be performed until this plan is validated.**

---

## 1. Objectives of SPRINT_1B

Lay down the Academy foundations in read-only:
- Prisma models for a hierarchical path Courses → Chapters → Lessons.
- Progress tracking per user × lesson.
- (Optional) weak link Chapter ↔ Quest to marry academic theory and gamified practice.
- Public API routes + SSR routes `/academy/**`.
- Markdown reader.
- Seed of a first real course ("Bitcoin Fundamentals").

This document covers **only** the schema + migration part. Routes and pages will be produced in a following sub-sprint after model validation.

---

## 2. Guiding Schema Principles

1. **Strictly additive.** No modification of the 8 existing models (`User`, `Quest`, `QuizQuestion`, `UserQuestProgress`, `Badge`, `UserBadge`, `WalletTransaction`, `UserEvent`).
2. **SQLite compatibility.** No native enums (use `String` with enumeration comment, as for `Quest.track`, `Badge.rarity`, etc.). JSON stored as `String` (consistent with existing).
3. **Optional back-refs.** New relations add *relation* fields on `User` and `Quest`. These are purely logical fields on Prisma side, which **generate no column** in the database: so technically still additive.
4. **Stable slugs** on URL side: each lesson is addressable by `/academy/[courseSlug]/[chapterSlug]/[lessonSlug]`. Composite uniqueness to avoid collisions.
5. **No silent cascade deletion.** Critical relations use `onDelete: Restrict` by default (prevents deleting a course that still contains lessons with progress).
6. **No MDX in the model.** The `content` field of a lesson stores pure Markdown (string). MDX will come in the admin sprint (phase 2).

---

## 3. Proposed Models

### 3.1 `Course`

A thematic path. E.g. "Bitcoin Fundamentals", "Lightning Network", "Key Security".

```prisma
model Course {
  id          String   @id @default(cuid())
  slug        String   @unique                 // e.g. "fondamentaux-bitcoin"
  title       String                            // "Bitcoin Fundamentals"
  subtitle    String                            // Short phrase (course hero)
  description String                            // Long paragraph (catalog page)
  coverIcon   String   @default("BookOpen")    // Lucide icon name (like Badge.icon)
  order       Int                               // display order in the catalog
  publishedAt DateTime?                         // null = draft (not publicly listed)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  chapters    Chapter[]
}
```

**Reasons for choices:**
- `slug` separate from `id` → readable, SEO-friendly URLs.
- Nullable `publishedAt` → simple "draft vs published" support without a Status table.
- `coverIcon` reuses the `Badge.icon` convention (Lucide name): no new convention to introduce.

### 3.2 `Chapter`

A section of a course.

```prisma
model Chapter {
  id        String   @id @default(cuid())
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Restrict)
  slug      String                               // e.g. "propriete-numerique"
  title     String                               // "Digital ownership"
  summary   String                               // 1-2 sentences visible in the summary
  order     Int                                  // position within the course

  lessons       Lesson[]
  linkedQuests  ChapterQuest[]

  @@unique([courseId, slug])                    // slug unique within its course
  @@index([courseId, order])
}
```

**Reasons:**
- Composite uniqueness `(courseId, slug)`: two courses can have an `introduction` chapter without collision.
- Index `(courseId, order)`: fast summary read.

### 3.3 `Lesson`

An atomic lesson.

```prisma
model Lesson {
  id          String   @id @default(cuid())
  chapterId   String
  chapter     Chapter  @relation(fields: [chapterId], references: [id], onDelete: Restrict)
  slug        String                              // e.g. "pourquoi-bitcoin"
  title       String                              // "Why Bitcoin?"
  summary     String                              // phrase visible in the summary
  content     String                              // pure Markdown
  estimatedMinutes Int   @default(5)              // estimated reading time
  order       Int                                 // position within the chapter
  publishedAt DateTime?                           // null = draft
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  progress    LessonProgress[]

  @@unique([chapterId, slug])
  @@index([chapterId, order])
}
```

**Reasons:**
- `content: String` → pure Markdown. Rendered via `react-markdown` (already in deps).
- `estimatedMinutes` → "5 min" display in the summary, helps the learner plan.
- No `theorySections` JSON like Quest, because we aim for free content structured in Markdown (with headings, lists, code blocks, etc.).

### 3.4 `LessonProgress`

State per user × lesson.

```prisma
model LessonProgress {
  userId       String
  lessonId     String
  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson       Lesson  @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  completedAt  DateTime @default(now())

  @@id([userId, lessonId])                        // unique pair = composite primary key
  @@index([userId])
}
```

**Reasons:**
- **Binary** model (read / not read), no "% read". Simpler, sufficient for V1.
- `@@id` composite: no synthetic id, O(1) read via key.
- `onDelete: Cascade`: if a learner is deleted (GDPR), their progress is too.
- `onDelete: Cascade` on the lesson side: if a lesson disappears from the catalog, orphan progress is automatically cleaned up (avoids the need for manual reconciliation).

### 3.5 `ChapterQuest` (pivot table, optional)

Links a chapter to an existing gamified quest. Purely additive: doesn't touch `Quest`.

```prisma
model ChapterQuest {
  chapterId String
  questId   String
  chapter   Chapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  quest     Quest   @relation(fields: [questId], references: [id], onDelete: Restrict)
  order     Int                                  // display position in the chapter
  note      String?                              // e.g. "To do after lesson 2"

  @@id([chapterId, questId])
  @@index([chapterId])
}
```

**Reasons for pivot vs optional `Quest.chapterId`:**
- `Quest.chapterId` would add a column to the existing `Quest` table → non-additive schema modification (adding a column is acceptable but less clean).
- A quest can be referenced by multiple chapters if the organization evolves.
- If we don't use the feature at SPRINT_1B, the `ChapterQuest` table simply stays empty — no impact.

### 3.6 Back-refs to add on existing models

**Important**: these fields are **purely Prisma** (ORM side). They generate no additional column in SQLite — the FK lives only in the new tables.

```prisma
model User {
  // … existing fields intact …
  lessonProgress LessonProgress[]   // NEW — back-ref only
}

model Quest {
  // … existing fields intact …
  chapters ChapterQuest[]           // NEW — back-ref only
}
```

Verification: Prisma Studio + `prisma db pull` will confirm that no column is added to `User` or `Quest`.

---

## 4. Complete Schema to Add (ready to copy)

Insert at the end of `prisma/schema.prisma`, after `UserEvent` (line 123).

```prisma
/* =============================================================
 * ACADEMY  — SPRINT_1B
 * Structured pedagogical path (Course → Chapter → Lesson),
 * complementary to the gamified quest system.
 * ============================================================= */

model Course {
  id          String    @id @default(cuid())
  slug        String    @unique
  title       String
  subtitle    String
  description String
  coverIcon   String    @default("BookOpen")
  order       Int
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  chapters    Chapter[]
}

model Chapter {
  id       String   @id @default(cuid())
  courseId String
  course   Course   @relation(fields: [courseId], references: [id], onDelete: Restrict)
  slug     String
  title    String
  summary  String
  order    Int

  lessons      Lesson[]
  linkedQuests ChapterQuest[]

  @@unique([courseId, slug])
  @@index([courseId, order])
}

model Lesson {
  id               String    @id @default(cuid())
  chapterId        String
  chapter          Chapter   @relation(fields: [chapterId], references: [id], onDelete: Restrict)
  slug             String
  title            String
  summary          String
  content          String
  estimatedMinutes Int       @default(5)
  order            Int
  publishedAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  progress LessonProgress[]

  @@unique([chapterId, slug])
  @@index([chapterId, order])
}

model LessonProgress {
  userId      String
  lessonId    String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  completedAt DateTime @default(now())

  @@id([userId, lessonId])
  @@index([userId])
}

model ChapterQuest {
  chapterId String
  questId   String
  chapter   Chapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  quest     Quest   @relation(fields: [questId], references: [id], onDelete: Restrict)
  order     Int
  note      String?

  @@id([chapterId, questId])
  @@index([chapterId])
}
```

Modifications **added** to existing models (only back-refs, no columns):

```prisma
model User {
  // … (unchanged) …
  lessonProgress LessonProgress[]   // ADDITION
}

model Quest {
  // … (unchanged) …
  chapters ChapterQuest[]           // ADDITION
}
```

---

## 5. Migration Plan — 3 Options

**Reminder**: the `db/custom.db` database exists but has **no versioned
Prisma migration** (`prisma/migrations/` is absent). Current tables were
created via `prisma db push` over time.

### Option A — Baseline + migrate dev (the cleanest)

Establishes Prisma Migrate discipline from now on, without touching existing data.

```bash
# 1. Baseline: mark the current schema as "init" already applied
docker compose -f docker-compose.dev.yml exec -T bitquest-dev npx prisma migrate dev \
  --name init --create-only
docker compose -f docker-compose.dev.yml exec -T bitquest-dev npx prisma migrate resolve \
  --applied $(ls prisma/migrations | head -1)

# 2. Edit prisma/schema.prisma to add the 5 new models + 2 back-refs
# 3. Generate and apply the add_academy migration
docker compose -f docker-compose.dev.yml exec -T bitquest-dev npx prisma migrate dev \
  --name add_academy
```

**Pros**:
- Adds versioned `prisma/migrations/` (traceable in git).
- `migrate dev` doesn't drop data as long as there's no drift.
- Migration identically re-runnable in CI or in prod later.

**Cons**:
- `migrate dev` has interactive behavior: if drift is detected, it proposes a reset (must answer `No`).
- The `--create-only` + `migrate resolve` is a one-off pattern to document.

**Risk**: if an interactive answer is mishandled and accepts the reset, data loss. **Mitigation**: snapshot of `db/custom.db` before any command + manual execution (you at the keyboard).

### Option B — `prisma db push` WITHOUT `--accept-data-loss`

Simpler, less clean.

```bash
# Edit prisma/schema.prisma (additions only, no deletion)
docker compose -f docker-compose.dev.yml exec -T bitquest-dev npx prisma db push
```

**Pros**:
- Single command.
- `db push` without `--accept-data-loss` **refuses** if the migration would lose data (column/table deletion, restricted type). Our change being purely additive, it should pass without intervention.

**Cons**:
- No versioned migration file.
- Will become technical debt when migrating to Postgres.

**Risk**: low for this additive change. If the push still proposes a deletion, we refuse.

### Option C — SQL by hand via sqlite3 CLI

```sql
CREATE TABLE Course ( ... );
CREATE UNIQUE INDEX ... ;
-- ... etc
```

**Pros**:
- Full control.

**Cons**:
- Divergence between `schema.prisma` and actual database (would also need to edit the schema and do a `prisma db pull` to realign).
- Waste of time compared to A or B.

**To discard** unless specific need.

---

## 6. Recommendation

**Option A (baseline + migrate dev)** if you want to install migration discipline right now. I recommend this option because we're moving toward Postgres soon and might as well lay down clean migrations.

**Option B (db push without --accept-data-loss)** if you prefer speed and simplicity in the short term. Zero loss risk on this purely additive change.

I lean slightly toward **Option A** but both are acceptable.

---

## 7. Security Points to Flag **Before Execution**

1. **Mandatory DB snapshot** before any command that touches the database:
   ```bash
   cp db/custom.db "db/custom.db.bak-$(date +%Y%m%d-%H%M%S)"
   ```
2. **Manual execution** of Prisma commands that require confirmation (interactive migrate dev) — I won't launch them via `exec -T` which bypasses TTY.
3. **Post-migration verification**:
   - `shasum -a 256 db/custom.db` (will note the legitimate change).
   - Count rows of each existing table → must be identical.
   - Check absence of added column in `User` and `Quest` (via `.schema User` and `.schema Quest` in sqlite3).
4. **Rollback**: restore the `.bak` snapshot if anything goes wrong.

---

## 8. Tasks Following Schema Validation

In order, once this plan is validated:

1. **DB snapshot** (line 1 above).
2. **Apply the schema** (option A or B depending on your choice).
3. **Verify** integrity of existing tables.
4. **Regenerate the Prisma client** and re-run `typecheck + lint + test` (must stay green).
5. **Write `prisma/seed.ts`** to add 1 "Bitcoin Fundamentals" course + 2 chapters × 3 lessons each in French. Run it **manually** (`npx prisma db seed` or dedicated script) — never destructive for existing tables.
6. **Create `src/lib/bitquest/academy.ts`** — typed read functions (getCoursesSummary, getCourseTree, getLessonWithProgress, selectNextLessonInCourse) + Vitest tests on the pure logic.
7. **API routes** `/api/academy/courses`, `/api/academy/courses/[slug]`, `/api/academy/lessons/[id]/complete`.
8. **SSR pages** `/academy`, `/academy/[courseSlug]`, `/academy/[courseSlug]/[chapterSlug]/[lessonSlug]`.
9. **Markdown reader** via `react-markdown` (lib already present).
10. **Activate the Dashboard Academy tile** (remove `disabled`, point to `/academy`).
11. **Consistent commit(s)** per sub-step.

---

## 9. Decisions to Confirm Before Execution

1. Proposed schema (§4) OK or adjustments?
2. Migration option — **A** or **B**? (I recommend A, but B is also acceptable.)
3. Keep `ChapterQuest` (Chapter↔Quest pivot) in the same sprint, or defer to a later sprint?
4. Confirmed `onDelete` policies (Cascade for LessonProgress/ChapterQuest, Restrict for Course→Chapter and Chapter→Lesson)?
5. Authorization for the `.bak` snapshot versioned locally (ignored by git)?
6. Can I run the Docker commands myself, or do you prefer I give them to you and you run them yourself (interactive TTY at the keyboard for migrate dev)?

---

**Written on**: 2026-11-09
**Status**: pending validation. **No modification of database, schema or source code until you have validated these 6 points.**
