# BitQuest

![Bitcoin](https://img.shields.io/badge/Bitcoin-FF9900?style=flat-square&logo=bitcoin&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js%2016-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg?style=flat-square)

**Gamified educational platform to learn Bitcoin and the Lightning Network.**

BitQuest is one of the two pillars of [GandalNexus](https://github.com/GandalNexus) (a Senegalese project awarded at the Dakar Bitcoin Hack 2025): the **learn → practice → earn** module that guides learners — from beginners to advanced — through a progressive discovery of Bitcoin. The hands-on side is covered by the sibling project [BitLab](https://github.com/GandalNexus/bitlab).

## Overview

BitQuest offers a structured journey of themed quests combining theory, mini-quizzes, and practical missions. Engagement is rewarded with XP, badges, and **symbolic** satoshis (see warning below).

### Quests

Each quest is made up of:

1. **An introduction** with context and learning objectives.
2. **Theoretical sections** (structured text + key takeaways).
3. **A quiz** that must be passed at 70% minimum to unlock the next step.
4. **A practical mission** (8 types available: block exploration, key forge, transaction building, nonce mining, Lightning channel opening, BOLT11 parsing, multisig, Taproot tweak).
5. **A reward**: XP and educational sats.

> ⚠️ **The satoshis distributed by BitQuest are educational points**, not real satoshis. No on-chain transfer or real Lightning payment is made in this version. Real Lightning integration via BitLab is planned for later phases (see `docs/BITQUEST_ROADMAP.md`).

### Current features (v0.3)

- **Authentication** — HttpOnly `bq_session` cookie, HMAC double-submit CSRF,
  password hashing (`scrypt`), email verification (foundation),
  GDPR soft-delete with PII anonymisation.
- **Roles** `APPRENTICE` / `EDITOR` / `ADMIN` + `requireRole*` helpers for API
  and SSR.
- **Dashboard** with level ring, statistics, timeline, onboarding
  and Academy teaser.
- **11 quests** seeded, spread across 4 tracks (initiation, intermediate,
  advanced, special). 8 mission types.
- **Academy**: courses → chapters → markdown lessons with completion tracking.
- **Daily challenge** with XP + sats rewards.
- **15 badges** (7 condition types).
- **Leaderboard** of the top 20 learners.
- **Educational wallet** + history.
- **Full admin console**: CRUD for courses, quests (metadata + theory +
  quiz + mission type), badges, daily challenges, users (roles),
  GDPR purge, audit log (24+ actions).
- **BitLab foundation** (Phase 3): `BitLabProof` model, `MempoolClient`
  (mempool.space + blockstream fallback), `/api/bitlab/proof` endpoint
  (`TX` or `INVOICE`), BOLT11 decoding, challenge JWT with Redis-backed
  anti-replay nonces. Pilot quest `tx-basics` wired to `BITLAB_PROOF`.
- **Observability**: `/api/health` (DB + Redis), Sentry (client + server,
  no-op if DSN is absent), structured pino logs with PII redactions.
- **Redis rate-limit** per route with in-memory fallback.
- **i18n FR/EN**: `bq_locale` cookie, `useT()` hook with `{var}`
  interpolation, dictionary parity.
- **Tests**: 310 unit (Vitest) + 9 Playwright scenarios + WCAG 2.1 AA a11y
  audit (@axe-core/playwright).
- **Dark theme** by default, Orbitron / Exo 2 / Geist Mono fonts.

### Planned features (roadmap)

- Real SMTP for email verification.
- WO locale (third language).
- i18n migration for the remaining components (quests, wallet, Academy).
- `BITLAB_PROOF` broadened beyond `tx-basics`
  (invoice-decode, channel-open).
- Lightning Testnet rewards behind a feature flag.

Full details in `docs/BITQUEST_ROADMAP.md` and `CHANGELOG.md`.

## Tech stack

### Frontend

- **Next.js 16** (App Router, Turbopack).
- **React 19** with Server Components.
- **TypeScript** strict (checked via `npm run typecheck`).
- **Tailwind CSS 4** + a curated subset of **shadcn/ui** primitives on Radix UI.
- **Lucide React** for icons.
- **Framer Motion** for animations.
- **next-themes** for dark mode.

### Client state

- **Zustand** for session and SPA navigation.
- **TanStack Query** for API call caching.

### Backend

- **Next.js Route Handlers** (`src/app/api/*`) for the internal JSON API.
- **Prisma 6** as ORM, **PostgreSQL 16** as database.
- **Redis 7** for sessions, rate-limiting, and anti-replay nonces (in-memory fallback).
- **Zod** for validation at every API boundary (discriminated unions).
- **Node.js native crypto** (`scrypt`) for password hashing.
- **jose** for short-lived BitLab JWTs (HS256).
- **@sentry/nextjs** for instrumentation (no-op without DSN).
- **pino** for structured logs with PII redactions.
- **ioredis** as the Redis client.

### Tests & quality

- **Vitest** + **happy-dom** for unit tests (310 tests / 17 files).
- **Playwright** for E2E scenarios (auth, admin gate, daily challenge).
- **@axe-core/playwright** for WCAG 2.1 AA a11y audit.
- **oxlint** + **ESLint** + **Prettier**.
- **GitHub Actions** (`.github/workflows/ci.yml`) with Postgres + Redis services.

## Quick start

### Option A — Docker (recommended)

A reproducible development environment is provided. See `docs/DOCKER_DEVELOPMENT.md` for full documentation.

```bash
# Build the image
docker compose -f docker-compose.dev.yml build

# Install dependencies in the named volume
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npm ci

# Generate the Prisma client
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npx prisma generate

# Start the dev server
docker compose -f docker-compose.dev.yml up
```

The app is available at `http://localhost:3000`.

### Option B — Local (Node 20+)

#### Prerequisites

- **Node.js 20** or later.
- **npm 10+** (npm 11 recommended — see note about `--package-lock-only`).

#### Install

```bash
git clone https://github.com/GandalNexus/bitquest.git
cd bitquest

# Configure the environment (Postgres + Redis required)
cat > .env <<'EOF'
DATABASE_URL="postgresql://bitquest:bitquest@localhost:5432/bitquest"
REDIS_URL="redis://localhost:6379"
SESSION_COOKIE_SECRET="change-me-in-production"
CSRF_SECRET="change-me-in-production"
NODE_ENV="development"
EOF

# Install and prepare
npm ci
npx prisma generate
npx prisma db push
npx prisma db seed

# Start
npm run dev
```

Open `http://localhost:3000`.

## npm scripts

| Command | Description |
|---|---|
| `npm run dev` | Next.js development server (port 3000) |
| `npm run build` | Next.js production build (⚠ see known issue at the bottom) |
| `npm start` | Production server (requires Bun for `.next/standalone/server.js`) |
| `npm run lint` | oxlint + ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Vitest tests (single run) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run format` | Prettier (write) |
| `npm run format:check` | Prettier (check only) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:push` | Sync the schema with the database (⚠ dev only, `--accept-data-loss`) |
| `npm run db:migrate` | Create/apply a Prisma migration (dev) |
| `npm run db:reset` | Reset the database (⚠ destructive) |

## Project structure

```
bitquest/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── api/                 # Route handlers (auth, me, quests, wallet, leaderboard)
│   │   ├── layout.tsx
│   │   ├── page.tsx             # SPA shell
│   │   └── global-error.tsx     # Root error boundary
│   ├── components/
│   │   ├── bitquest/            # Feature components (dashboard, quest-player, etc.)
│   │   └── ui/                  # shadcn/ui primitives used (12)
│   ├── hooks/                   # Shared React hooks
│   ├── lib/
│   │   ├── bitquest/            # Domain layer (progression, missions, quests, …)
│   │   ├── db.ts                # Prisma singleton
│   │   ├── seed-data.ts         # 11 quests + 15 badges + leaderboard bots
│   │   └── utils.ts
│   └── test/
│       └── setup.ts             # Vitest setup
├── prisma/
│   ├── schema.prisma            # 8 models (User, Quest, QuizQuestion, …)
│   └── seed.ts
├── docs/                        # Audit, architecture, roadmap, phases, release notes
├── public/                      # Static assets
├── e2e/                         # Playwright scenarios + axe-core audit
├── Dockerfile.dev
├── docker-compose.dev.yml       # Postgres 16 + Redis 7 + dev app
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Documentation

All design and audit documents live in `docs/`:

- `BITQUEST_AUDIT.md` — Audit of the existing codebase.
- `BITQUEST_ARCHITECTURE.md` — Target architecture.
- `BITQUEST_FEATURE_MATRIX.md` — Gap between current and target.
- `BITQUEST_INTEGRATION_BITLAB.md` — Planned BitLab integration.
- `BITQUEST_ROADMAP.md` — Phase-by-phase development plan.
- `DOCKER_DEVELOPMENT.md` — Docker dev environment.
- `PHASE_0_REPORT.md` — Technical hygiene report (Phase 0).
- `PHASE_3_BITLAB.md` — BitLab foundation (TX + INVOICE + JWT challenge).
- `SECURITY_CHECKLIST.md` — Phase 5.5 preparation.
- `SPRINT_1B_SCHEMA_PLAN.md` — Sprint 1B schema migration plan.
- `LOT_1_DASHBOARD_ACADEMIE.md` — Dashboard audit + Academy plan.
- `RELEASE_NOTES_v0.3.md` — Release 0.3 notes.
- `CHANGELOG.md` (root) — Versioned log.

## Environment variables

| Variable | Role | Required |
|---|---|---|
| `DATABASE_URL` | Postgres URL | Yes |
| `REDIS_URL` | Redis URL | Yes (in-memory fallback if absent) |
| `SESSION_COOKIE_SECRET` | Session cookie HMAC | Yes |
| `CSRF_SECRET` | CSRF token HMAC | Yes |
| `BITLAB_JWT_SECRET` | BitLab challenge JWT secret | No (falls back to `CSRF_SECRET`) |
| `SENTRY_DSN` | Sentry instrumentation | No (no-op if absent) |

## Known issues

- **npm vulnerabilities**: a few moderate CVEs persist on transitive
  dependencies (sharp, @mdxeditor/editor, react-syntax-highlighter).
  All remediations involve a breaking change. To be addressed in a
  dedicated window.

## Contributing

Contributions are welcome! See `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.

Workflow:

1. Fork + feature branch.
2. Check locally: `npm run lint && npm run typecheck && npm test`.
3. Open a Pull Request against `main`.

## Security

Have a vulnerability to report? Please **do not** open a public issue. Follow the procedure described in `SECURITY.md`.

## License

[AGPL-3.0](LICENSE) © GandalNexus
