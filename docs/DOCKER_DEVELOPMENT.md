# Docker development environment — BitQuest

> This document describes the reproducible development environment for BitQuest,
> based on Docker. Since Phase 0.4, the primary database is
> **PostgreSQL** (`postgres` service in `docker-compose.dev.yml`). The
> `db/custom.db` SQLite file is a historical remnant kept for possible
> recovery but no longer used by the application. For prod operations
> (migrations, backup/restore), see [`POSTGRES_PROD.md`](POSTGRES_PROD.md).

---

## 1. Purpose

- Isolate Node.js dependencies from the macOS host.
- Make the toolchain reproducible (Node 20, Prisma 6, Next.js 16, Postgres 16, Redis 7).
- Enable hot-reload (HMR) for local changes.
- Provide a ready-to-use local Postgres (bind mount of the `postgres_data` volume).

---

## 2. Associated files

| File | Role |
|---|---|
| `Dockerfile.dev` | Dev image based on `node:20-bookworm-slim` |
| `docker-compose.dev.yml` | Orchestration: single service, named volumes for `node_modules` and `.next`, bind mount for the code and the SQLite database |
| `.dockerignore` | Minimal build context (does not delete any file from the repo) |

The `docker-compose.yml` file (PostgreSQL only) can be used as a
minimal alternative if you only want Postgres without the app.

---

## 3. Prerequisites

- Docker Desktop ≥ 20.10 (tested on Docker 24).
- Docker Compose v2.

---

## 4. Persistence model

| Host path | Container path | Type | Role |
|---|---|---|---|
| `./` | `/app` | bind mount (cached) | Source code, live editing from macOS |
| (named volume) | `/app/node_modules` | Docker volume `bitquest_node_modules` | Native Linux binaries, isolated from host |
| (named volume) | `/app/.next` | Docker volume `bitquest_next_cache` | Next.js cache persistent across restarts |
| (named volume) | `/var/lib/postgresql/data` (container `bitquest-db`) | Docker volume `bitquest_postgres_data` | **Postgres data** persistent |
| `./db` | `/app/db` | bind mount | SQLite remnant (`custom.db` + backups). Not read by the app. |

**Guarantee**: the `bitquest_postgres_data` volume is preserved between
`docker compose down` and `up`. To delete it explicitly:
`docker compose down -v` (destructive).

---

## 5. Injected environment variables

| Variable | Value | Reason |
|---|---|---|
| `NODE_ENV` | `development` | Next.js standard |
| `DATABASE_URL` | `postgresql://bitquest:bitquest_dev_password@postgres:5432/bitquest?schema=public` | Postgres via the compose service |
| `REDIS_URL` | `redis://redis:6379` | Distributed rate-limit (in-memory fallback if service down) |
| `CHOKIDAR_USEPOLLING` | `true` | Reliable HMR with macOS bind mount |
| `WATCHPACK_POLLING` | `true` | Webpack/Turbopack watch on bind mount |
| `NEXT_TELEMETRY_DISABLED` | `1` | Avoids the Next telemetry network call |

**No need to create an `.env` on the host**: compose provides everything.

---

## 6. Commands

### 6.1 First startup (one-time)

```bash
# 1. Build the image
docker compose -f docker-compose.dev.yml build

# 2. Install dependencies into the dedicated volume (long, ~1-3 min)
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npm ci

# 3. Generate the Prisma client (required before starting Next)
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npx prisma generate
```

### 6.2 Daily startup

```bash
# Start the dev server (port 3000)
docker compose -f docker-compose.dev.yml up

# OR in the background
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml logs -f bitquest-dev
```

The application is accessible at `http://localhost:3000`.

### 6.3 Shutdown

```bash
# Shutdown (preserves volumes)
docker compose -f docker-compose.dev.yml down

# Shutdown + delete volumes (⚠ loses the .next cache and node_modules)
docker compose -f docker-compose.dev.yml down -v
# ⚠ db/custom.db will NOT be deleted (it's a bind mount, not a volume)
```

### 6.4 Quality control commands (on running container)

```bash
# ESLint + oxlint
docker compose -f docker-compose.dev.yml exec bitquest-dev npm run lint

# TypeScript check
docker compose -f docker-compose.dev.yml exec bitquest-dev npx tsc --noEmit

# Vitest tests (requires the vitest.config.ts fix planned in Phase 0)
docker compose -f docker-compose.dev.yml exec bitquest-dev npx vitest run

# Next.js build
docker compose -f docker-compose.dev.yml exec bitquest-dev npm run build

# Prettier formatting
docker compose -f docker-compose.dev.yml exec bitquest-dev npm run format
```

### 6.5 "One-shot" commands (without starting the server)

```bash
# Ideal for local CI or ad-hoc checks
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npm run lint
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npx tsc --noEmit
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npx vitest run
```

### 6.6 Interactive shell

```bash
docker compose -f docker-compose.dev.yml exec bitquest-dev bash
# inside the container:
# node --version
# npm --version
# npx prisma --version
# ls -la db/
```

### 6.7 Prisma (READ-ONLY operations for Phase 0)

```bash
# Generate the client (safe)
docker compose -f docker-compose.dev.yml exec bitquest-dev npx prisma generate

# Introspect the existing database (safe)
docker compose -f docker-compose.dev.yml exec bitquest-dev npx prisma db pull
```

**DO NOT run in Phase 0** (destructive or structurally risky):

```bash
# ⛔ Modifies the database
# npx prisma db push
# npx prisma migrate dev
# npx prisma migrate reset
```

These commands will be discussed in the next phase after explicit
validation.

---

## 7. Hot Module Replacement (HMR)

HMR is enabled via polling (`CHOKIDAR_USEPOLLING=true`) to make file
change detection reliable on macOS via Docker Desktop.

- Edit a `src/**/*.tsx` file → automatic recompilation.
- Check the logs: `docker compose -f docker-compose.dev.yml logs -f bitquest-dev`.
- Expected: lines `✓ Compiled in …` or `Compiling /...`.

If HMR does not fire:
1. Check that `CHOKIDAR_USEPOLLING=true` is properly injected: `docker compose -f docker-compose.dev.yml exec bitquest-dev env | grep POLLING`.
2. Check that the bind mount is active: `docker compose -f docker-compose.dev.yml exec bitquest-dev ls -la /app/src/app/page.tsx` (must reflect the most recent change).

---

## 8. Troubleshooting

### 8.1 `EACCES` or permissions on `node_modules`

Cause: named volume created by a different user during a previous attempt.

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npm ci
```

### 8.2 Prisma error `Can't reach database server`

Cause: `DATABASE_URL` misinterpreted.

```bash
# Check
docker compose -f docker-compose.dev.yml exec bitquest-dev env | grep DATABASE_URL
# Expected: file:/app/db/custom.db

# Check that the database exists INSIDE the container
docker compose -f docker-compose.dev.yml exec bitquest-dev ls -la /app/db/
# Expected: custom.db present
```

### 8.3 Port 3000 busy on the Mac

```bash
# Find the process
lsof -i :3000

# OR change the host port in docker-compose.dev.yml:
# ports:
#   - "3001:3000"
```

### 8.4 `Cannot find module '../lightningcss.linux-x64-gnu.node'`

Symptom (seen on `next dev` inside the container):

```
Error: Cannot find module '../lightningcss.linux-x64-gnu.node'
Require stack:
- /app/node_modules/lightningcss/node/index.js
- /app/node_modules/@tailwindcss/node/dist/index.js
- /app/node_modules/@tailwindcss/postcss/dist/index.js
```

Cause: `lightningcss` (pulled by `@tailwindcss/postcss` under Tailwind 4)
ships its native binary as a set of **platform-specific optional
dependencies** (`lightningcss-darwin-x64`, `lightningcss-linux-x64-gnu`,
etc.). npm 10 has a long-standing bug where, on `npm ci`, it sometimes
installs **only the current platform's** optional binary and skips the
others — even though the lockfile lists all nine of them. When macOS
runs `npm ci` and the resulting `node_modules` ends up inside the Linux
container's named volume, the Linux binary is missing and PostCSS
cannot load Tailwind.

**Fast fix** (keeps the volume, adds the missing binary and bridges the
two paths Turbopack tries):

```bash
# 1. Install the native optional dep that npm dropped
docker compose -f docker-compose.dev.yml exec bitquest-dev \
  npm install lightningcss-linux-x64-gnu@1.33.0 --no-save --force

# 2. Symlink the binary to the fallback path that Turbopack also tries
#    (lightningcss/node/index.js line 19 falls back to `../*.node` when
#    `require('lightningcss-<platform>')` fails under the Turbopack bundler)
docker compose -f docker-compose.dev.yml exec bitquest-dev \
  ln -sfv ../lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node \
          node_modules/lightningcss/lightningcss.linux-x64-gnu.node

# 3. Purge the Turbopack cache (the previous failed PostCSS resolution is
#    baked into `.next/dev/build/chunks/*`)
docker compose -f docker-compose.dev.yml exec bitquest-dev \
  sh -c "find .next -mindepth 1 -maxdepth 1 -exec rm -rf {} +"

# 4. Restart
docker compose -f docker-compose.dev.yml restart bitquest-dev
```

**Clean fix** (resets the volume, reinstalls from scratch inside the
container with all optional deps included):

```bash
docker compose -f docker-compose.dev.yml down
docker volume rm bitquest_node_modules
docker compose -f docker-compose.dev.yml run --rm bitquest-dev \
  npm ci --include=optional
docker compose -f docker-compose.dev.yml run --rm bitquest-dev \
  npx prisma generate
docker compose -f docker-compose.dev.yml up
```

**Permanent prevention**: the repo ships an `.npmrc` with
`include=optional` so every `npm ci`/`npm install` keeps the
cross-platform binaries. If that file disappears, re-add:

```
# .npmrc
include=optional
```

### 8.5 Full reset (last resort)

```bash
docker compose -f docker-compose.dev.yml down -v
docker rmi bitquest-dev 2>/dev/null
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npm ci
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npx prisma generate
```

`db/custom.db` is preserved (bind mount, not a volume).

---

## 9. Out of scope for this document

- Production image (will be addressed after the PostgreSQL migration).
- CI image (phase 0 will use GitHub Actions with `node:20`, no Docker).
- PostgreSQL (original `docker-compose.yml`). Kept but not used in this flow.

---

## 10. Expected validation

After `docker compose -f docker-compose.dev.yml up`, you should be able to:

- [ ] Open `http://localhost:3000` from Safari/Chrome on the Mac.
- [ ] See the BitQuest home page (or the auth screen).
- [ ] Edit `src/app/page.tsx` from macOS and see automatic recompilation.
- [ ] Verify that `db/custom.db` keeps its initial size/date.
- [ ] Run `npm run lint` in the container without a network error.

If any of these fails, see the Troubleshooting section.
