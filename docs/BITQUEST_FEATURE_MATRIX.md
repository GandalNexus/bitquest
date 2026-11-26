# BitQuest feature matrix — 2026-11-09

> Gap between the **audited existing** (`BITQUEST_AUDIT.md`) and the **target architecture** (`BITQUEST_ARCHITECTURE.md`). For each feature, we specify what is present, partial, cosmetic or absent, as well as the estimated effort to reach the target.

**Current state legend:**
- 🟢 **Operational** — coded, manually tested, usable
- 🟡 **Incomplete** — partially coded, bugs or missing cases
- 🔵 **UI only** — interface present but no business logic behind
- ⚪ **Absent** — nothing exists
- 🔴 **Defective** — present but broken or dangerous

**Effort legend:**
- `S`: < 1 dev-day
- `M`: 1–3 days
- `L`: 4–10 days
- `XL`: > 10 days

---

## A. User account management

| Feature | State | Evidence (file:line) | Target | Effort |
|---|---|---|---|---|
| Email/password signup | 🟢 | `src/app/api/auth/route.ts:40-70` | Harden: Zod, password policy (8+ chars, zxcvbn ≥ 2) | S |
| Email/password login | 🟢 | `src/app/api/auth/route.ts:72-95` | Same + lockout after N failures | S |
| Guest login | 🟢 | `src/app/api/auth/route.ts:97-110` | Keep, add conversion → permanent account | M |
| Nostr login (NIP-07) | ⚪ | — | NextAuth v5 + custom provider | L |
| Wallet / NIP-98 login | ⚪ | — | Phase 2+ | L |
| Password hashing | 🟢 | `scryptSync` (`src/app/api/auth/route.ts:16-24`) | Keep | — |
| Session (transport) | 🔴 | `localStorage` + custom headers | `httpOnly; Secure; SameSite=Lax` cookie + CSRF | M |
| Middleware route protection | 🔴 | `middleware.ts` looks for a cookie never set | Rewrite on real session cookie | S |
| Profile (read) | 🟢 | `src/app/api/me/route.ts` | Enrich (courses in progress, next steps) | S |
| Profile (edit) | 🟡 | `src/components/bitquest/profile-view.tsx` exists, no PATCH endpoint | Add `PATCH /api/me` | S |
| Language preference | ⚪ | — | `User.preferredLocale` field + endpoint | S |
| Activity history | 🟢 | `UserEvent` + dashboard timeline | Enrich (filters by type) | S |
| Logout | 🟡 | Clear localStorage on client side | `/api/auth/logout` endpoint that invalidates the cookie | S |
| Account deletion (GDPR) | ⚪ | — | Soft delete + event purge | M |
| 2FA/MFA | ⚪ | — | Phase 2+ | L |
| Login/signup rate limit | 🟡 | In-memory, non-persistent | Redis | M |

**Section A totals**: ~7 days.

---

## B. Bitcoin Academy (learning paths)

| Feature | State | Evidence | Target | Effort |
|---|---|---|---|---|
| Course model | ⚪ | Absent from `prisma/schema.prisma` | Create model + migration | S |
| Chapter model | ⚪ | — | Create model + migration | S |
| Lesson model | ⚪ | — | Create MDX model + migration | M |
| Multimedia content (images/diagrams/videos) | ⚪ | Only text in `seed-data.ts` | `LessonAsset` model + S3/R2 upload | M |
| Per-lesson progression | ⚪ | — | `LessonProgress` model | S |
| Transversal pedagogical prerequisites | ⚪ | Just "previous quest" (`src/lib/bitquest/quests.ts:40-60`) | Add inter-chapter dependencies | M |
| Lesson reader | ⚪ | — | SSR `/academy/[course]/[chapter]/[lesson]` page + MDX renderer | L |
| In-course progression indicator | ⚪ | — | Progress bar / course | S |
| Course catalog | ⚪ | — | `/academy` page with filters | M |
| End-of-path certification | ⚪ | — | `Certificate` model + PDF rendering | L |

**Section B totals**: ~18 days.

---

## C. Quests and missions

| Feature | State | Evidence | Target | Effort |
|---|---|---|---|---|
| Quest model | 🟢 | `prisma/schema.prisma:31-49` | Add `chapterId`, `estimatedMinutes`, `publishedAt` | S |
| Quest map (user side) | 🟢 | `src/components/bitquest/quest-map.tsx` | Shareable URL `/quests` | S |
| 4-step quest player | 🟢 | `src/components/bitquest/quest-player.tsx` | SSR `/quests/[code]` page | M |
| Unlocking by level + order | 🟢 | `src/lib/bitquest/quests.ts:40-70` | Keep | — |
| 8 simulated mission types | 🟢 | `src/lib/bitquest/missions.ts` (568 lines) | Keep | — |
| BitLab mission (real proof) | ⚪ | No code | New `missionKind: BITLAB_PROOF` + verifier | L |
| Server-side validation | 🟢 | `src/app/api/quests/[code]/progress/route.ts` | Keep | — |
| Reward idempotence | 🟡 | Via `completedAt`/`missionProof` flag | Add explicit idempotency key | S |
| Limited attempts | 🟢 | `MISSION_MAX_ATTEMPTS` in `progression.ts` | Keep | — |
| Proof history | 🟡 | Stored in `UserQuestProgress.missionProof` | Dedicated `BitLabProof` model | S |
| Daily quests | ⚪ | — | `DailyChallenge` model + cron | M |
| Weekly quests | ⚪ | — | `WeeklyChallenge` model | M |
| Event quests (SPECIAL) | 🟡 | Track exists, 0 content | Populate via admin | M |
| Community quests | ⚪ | — | Phase 2+ | L |

**Section C totals**: ~15 days.

---

## D. Quiz and evaluations

| Feature | State | Evidence | Target | Effort |
|---|---|---|---|---|
| MCQ questions | 🟢 | `prisma/schema.prisma:51-63` | Keep | — |
| True/false questions | 🟢 | Same | Keep | — |
| Multiple-answer questions | ⚪ | Not supported | Add `MULTI` type (answer bitmap) | M |
| Bitcoin logic validation questions | ⚪ | Not supported | Add `LOGIC` type (expression → expected) | L |
| Server-side grading | 🟢 | `src/app/api/quests/[code]/progress/route.ts:109-162` | Keep | — |
| Pedagogical explanations | 🟢 | Returned per question | Keep | — |
| Passing threshold | 🟢 | 70% via `QUIZ_PASS_THRESHOLD` | Configurable per quest | S |
| Question bank / randomization | ⚪ | Fixed questions per quest | QuestionBank model, draw N among M | M |
| Attempt history | 🟢 | `quizAttempts`, `quizBestScore` | Keep | — |
| Orphan field `QuizQuestion.quest2` | 🔴 | `prisma/schema.prisma:62` | Remove | S |

**Section D totals**: ~5 days.

---

## E. Gamification

| Feature | State | Evidence | Target | Effort |
|---|---|---|---|---|
| XP and sources | 🟢 | `XP_RULES` in `progression.ts` | Keep | — |
| 10 levels | 🟢 | `src/lib/bitquest/progression.ts` | Keep, make configurable | S |
| Badges (15 in seed) | 🟢 | `src/lib/seed-data.ts` | Keep + add via admin | S |
| Automatic badge evaluation | 🟢 | `evaluateBadges` | Keep | — |
| 7 condition types | 🟢 | `prisma/schema.prisma:93-94` | Keep | — |
| Daily streaks | 🟢 | `User.streak` + `lastActiveDate` | Keep | — |
| Streak bonus on sats | 🟢 | `awardSats` 0–50% | Keep | — |
| Leaderboards | 🟢 | `src/app/api/leaderboard/route.ts` | Add filters (weekly, monthly, track) | S |
| Friends / private leaderboards | ⚪ | — | Phase 2+ | M |
| Achievements (beyond badges) | ⚪ | — | Optional | — |
| Daily challenges | ⚪ | — | Section C | — |
| Reward history | 🟢 | `WalletTransaction` + timeline | Keep | — |

**Section E totals**: ~3 days.

---

## F. Bitcoin / Lightning rewards

| Feature | State | Evidence | Target | Effort |
|---|---|---|---|---|
| Sats as educational counter | 🟢 | `User.sats` | Keep for phase 1 | — |
| Daily cap (10,000 sats) | 🟢 | `SATS_DAILY_CAP` | Keep + configurable | S |
| Educational wallet | 🟡 | Just a balance, not a real wallet | "Symbolic wallet" view + onboarding | S |
| WebLN integration | ⚪ | — | Phase 3 | L |
| Server Lightning node (LDK or LND) | ⚪ | — | Phase 3 (archi decision) | XL |
| Lightning testnet reward | ⚪ | — | Phase 3 behind feature flag | XL |
| `LightningRewardService` service | ⚪ | — | Phase 3 | L |
| `txid` proof verification | ⚪ | — | Phase 2 (BitLab mission) | M |
| `bolt11` proof verification | ⚪ | — | Phase 2 | M |
| Double reward protection | 🟡 | `missionProof` flag | Idempotency key + Redis persistence | S |
| Reward rate limit (per IP + per user) | 🟡 | 100 req/min via memory | Redis + specific caps | M |
| Reward audit / log | 🟡 | `WalletTransaction` + `UserEvent` | `RewardIdempotencyKey` model | S |

**Section F totals** (phase 2 only): ~5 days.
**Section F totals** (phase 3 real Lightning): ~30 days.

---

## G. Administration

| Feature | State | Evidence | Target | Effort |
|---|---|---|---|---|
| `/admin` route | ⚪ | — | Create | S |
| Roles (`APPRENTICE`, `EDITOR`, `ADMIN`) | ⚪ | `User.role` absent | Add field + enum | S |
| Role guard | ⚪ | — | `requireRole` helper | S |
| Course CRUD | ⚪ | — | Section B | S |
| Chapter CRUD | ⚪ | — | Section B + DnD | M |
| Lesson CRUD (MDX) | ⚪ | — | With `@mdxeditor/editor` editor | L |
| Quest CRUD | ⚪ | — | Builder with preview | L |
| Quiz CRUD | ⚪ | — | Builder per type | M |
| Badge CRUD | ⚪ | — | — | M |
| User management | ⚪ | — | Read + role change + soft delete | M |
| Global stats dashboard | ⚪ | — | DAU, quests completed, sats distributed | M |
| Audit log | ⚪ | — | Model + consultation page | M |
| Moderation | ⚪ | — | Phase 2+ | L |
| CSV export | ⚪ | — | — | S |
| Daily / weekly challenge management | ⚪ | — | Calendar | M |

**Section G totals**: ~20 days.

---

## H. UI/UX

| Feature | State | Evidence | Target | Effort |
|---|---|---|---|---|
| User dashboard | 🟢 | `src/components/bitquest/dashboard.tsx` | Keep + improve next steps | S |
| Global navigation | 🟡 | Internal SPA via Zustand | Real routes + accessible sidebar | M |
| Course cards | ⚪ | — | Section B | — |
| Visual path (quest map) | 🟢 | `quest-map.tsx` | SSR + deep-link | S |
| Interactive quiz | 🟢 | `quest-player.tsx` | Keep | — |
| Mission UI (8 types) | 🟢 | `mission-panel.tsx` | Keep | — |
| Progression animations | 🟢 | Framer Motion | Keep | — |
| Reward animations | 🟡 | Basic confetti | Enrich (level up, badge unlock) | S |
| Admin dashboard | ⚪ | — | Section G | — |
| Dark mode | 🟢 | `next-themes` | Keep | — |
| Light mode polish | 🟡 | Functional but contrasts to check | Visual audit | S |
| Mobile-first responsive | 🟡 | `use-mobile.ts` hook, uneven | Full audit | M |
| Accessibility (a11y) | ⚪ | Not evaluated | WCAG AA audit + `jest-axe` tests | M |
| 404 / error / offline page | ⚪ | — | `not-found.tsx`, `error.tsx` | S |
| Orphan shadcn components | 🟡 | 36/48 unused | Clean up | S |
| Low data consumption (Africa) | ⚪ | No perf budget set | Lazy load images, skeletons, optional service worker | M |

**Section H totals**: ~10 days.

---

## I. Internationalization

| Feature | State | Evidence | Target | Effort |
|---|---|---|---|---|
| next-intl configured | ⚪ | Dependency installed, 0 import | Full setup | M |
| FR / EN locales | ⚪ | — | 2 complete dictionaries | L |
| WO locale | ⚪ | — | Progressive | L |
| Language selector | ⚪ | — | In shell | S |
| Multilingual quest content | ⚪ | FR only | `title_fr`/`title_en`/`title_wo` fields on `Quest`, `Lesson` | M |
| Localized dates/numbers | ⚪ | `date-fns/locale fr` only | `Intl.DateTimeFormat` via next-intl | S |

**Section I totals**: ~8 days (FR+EN), +L for WO.

---

## J. BitLab integration

| Feature | State | Evidence | Target | Effort |
|---|---|---|---|---|
| Deep-link to BitLab | ⚪ | — | `src/components/bitquest/mission-panel.tsx`: "Open in BitLab" button | S |
| Mission context transmission | ⚪ | — | JWT challenge | M |
| BitLab proof reception | ⚪ | — | `POST /api/bitlab/proof` endpoint | M |
| txid verification via mempool.space | ⚪ | — | `MempoolClient` service | M |
| BOLT11 verification | ⚪ | — | `bolt11` lib + validation | M |
| BOLT12 verification | ⚪ | — | More complex, phase 3 | L |
| Proof logging | ⚪ | — | `BitLabProof` model | S |
| Replay protection | ⚪ | — | Single-use JWT challenge | S |
| BitQuest ↔ BitLab SSO | ⚪ | — | Phase 2: just userId in JWT | S |

**Section J totals**: ~10 days.

---

## K. Quality, tests, DevOps, security

| Feature | State | Evidence | Target | Effort |
|---|---|---|---|---|
| Lint oxlint + eslint | 🟢 | `oxlint.json`, `eslint.config.mjs` | Keep | — |
| Prettier | 🟢 | `prettier.config.mjs` | Keep | — |
| Effective TS strict | 🔴 | `next.config.ts:7`: `ignoreBuildErrors: true` | Remove, fix errors | M |
| Vitest | 🔴 | Config pointed to nonexistent paths | Fix config, write tests | S |
| Unit tests `progression.ts` | ⚪ | — | Cover XP, levels, streak, awardSats | M |
| Unit tests `missions.ts` | ⚪ | — | Cover the 8 types | M |
| API route integration tests | ⚪ | — | Vitest + supertest-like | M |
| E2E tests | ⚪ | — | Playwright on quest path | L |
| a11y tests | ⚪ | — | `@axe-core/playwright` | S |
| GitHub Actions CI | ❓ | `.github/` present, not inspected | Confirm / create lint + typecheck + test + build workflow | S |
| Pre-commit hooks | ⚪ | — | `lefthook` or `husky` + `lint-staged` | S |
| SQLite → Postgres migration | ⚪ | — | Prisma migrate init + conversion | M |
| Versioned migrations | ⚪ | No `prisma/migrations/` | Enable | S |
| Zod at all boundaries | ⚪ | Zod installed, 0 usage | Schemas per route | M |
| Redis rate limiting | ⚪ | Memory | Upstash/local Redis | M |
| Sentry / error monitoring | ⚪ | — | Sentry self-hosted or cloud | S |
| Structured logs | ⚪ | Occasional `console.log` | `pino` | S |
| `/api/health` health check | ⚪ | — | Simple DB ping | S |
| Secrets / env docs | 🟡 | Minimalist `.env.example` | Enrich | S |
| `next.config.ts`: `ignoreBuildErrors` | 🔴 | line 7 | Remove | — |
| `package.json.name` naming | 🔴 | `nextjs_tailwind_shadcn_ts` | Rename `bitquest` | S |
| Remove `z-ai-web-dev-sdk` | 🔴 | Orphan dependency | Remove | S |
| Cleanup unused deps | 🟡 | next-auth, next-intl, @mdxeditor, @dnd-kit, 36 shadcn/ui | `depcheck` audit + removal | S |
| Remove `db/custom.db` from tracking | 🟡 | Local, ignored by .gitignore but present | Physically clean | S |
| Bug bounty activated | ⚪ | SECURITY.md exists | Announce | S |

**Section K totals**: ~15 days.

---

## Global summary by phase

| Phase | Scope | Estimated effort |
|---|---|---|
| **Phase 0 — Hygiene** | Deps cleanup, package rename, remove `ignoreBuildErrors`, remove `z-ai-web-dev-sdk`, fix vitest config, Prisma indexes, SQLite → Postgres migration | ~5 d |
| **Phase 1 — Security & robustness** | httpOnly cookie + CSRF, Zod everywhere, Redis rate limit, roles + guard, unit tests on domain | ~10 d |
| **Phase 2 — Academy & admin** | Course/Chapter/Lesson models, MDX editor, full admin CRUD, i18n FR+EN, daily challenges | ~35 d |
| **Phase 3 — BitLab integration** | Deep-link + JWT, txid/BOLT11 verification via mempool.space, `BITLAB_PROOF` mission | ~10 d |
| **Phase 4 — Lightning rewards** | Lightning testnet, `LightningRewardService`, feature flag, security audits | ~30 d |
| **Phase 5 — Industrialization** | E2E, a11y, monitoring, pentest, active bug bounty, WO locale | ~15 d |
| **Total** | | **~105 dev-d** |

> These estimates assume a solo senior full-stack developer. In pairs, count 60–70 calendar days.

---

**Written on**: 2026-11-09
**Next deliverable**: `BITQUEST_INTEGRATION_BITLAB.md`
