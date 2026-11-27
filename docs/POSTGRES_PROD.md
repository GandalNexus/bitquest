# Production PostgreSQL — BitQuest

**Date**: 2026-11-11
**Status**: Postgres is the production **and** dev DB since Phase 0.4.
The `db/custom.db` (SQLite) file is a historical vestige kept for possible
recovery, but no longer used by the application.

---

## 1. Context

- `prisma/schema.prisma` declares `provider = "postgresql"`.
- 4 versioned migrations under `prisma/migrations/`:
  - `20261110221940_init`
  - `20261110230829_add_bitlab_proof`
  - `20261110232859_add_quest_mission_kind`
  - `20261110233500_add_email_verification`
- `docker-compose.yml` provides a `postgres` service (image `postgres:16-alpine`).
- `docker-compose.dev.yml` plugs the dev app into this same Postgres via the
  `bitquest-db` container.

**Therefore**: neither in dev nor in prod does any line of code touch SQLite.
`db/custom.db` and its backups (`custom.db.bak-*`) are **never** read by
the current application.

---

## 2. npm Commands

| Command | Role |
|---|---|
| `npm run db:generate` | Generates the Prisma client (after modifying `schema.prisma`) |
| `npm run db:migrate` | `prisma migrate dev` — creates/applies a migration in dev |
| `npm run db:migrate:deploy` | `prisma migrate deploy && prisma generate` — applies pending migrations **and** regenerates the Prisma client so new fields are visible to the runtime (prod). |
| `npm run db:push` | `prisma db push --accept-data-loss` — to avoid in prod |
| `npm run db:reset` | Full reset (dev only, destructive) |
| `npm run db:seed` | Initial seed (`prisma/seed.ts`) |
| `npm run db:backup` | Timestamped dump + gzip in `backups/` + rotation 7 (default) |
| `npm run db:restore -- <file>` | Restores from a `.dump.gz` (asks for confirmation) |

---

## 3. Production Deployment

### First installation

```bash
# 1. Start Postgres
docker compose up -d postgres

# 2. Apply existing migrations (doesn't try to create new ones)
DATABASE_URL="postgresql://user:pass@host:5432/bitquest" \
  npm run db:migrate:deploy

# 3. Initial seed (optional — starting pedagogical content)
DATABASE_URL="postgresql://..." npm run db:seed
```

### Update (continuous deployment)

```bash
# From the up-to-date repo
DATABASE_URL="..." npm run db:migrate:deploy
```

`migrate deploy` is **idempotent**: it applies pending migrations
and touches nothing if everything is already up to date.

---

## 4. Backup / Restore

### Daily backup

```bash
# Via docker (default — uses the bitquest-db container)
npm run db:backup

# Via host (pg_dump installed locally, custom DATABASE_URL)
DATABASE_URL="..." npm run db:backup

# Retention: keep last 14 (default 7)
RETENTION=14 npm run db:backup
```

Produces `backups/bitquest-<timestamp>.dump.gz` in pg_dump custom format
(compatible with `pg_restore`, portable between Postgres 15+ versions).

**For a system cron**:

```cron
# /etc/cron.d/bitquest-backup — every day at 3am UTC
0 3 * * * cd /srv/bitquest && /usr/bin/env RETENTION=30 ./scripts/backup-postgres.sh >> /var/log/bitquest-backup.log 2>&1
```

### Restore

```bash
# From a backup file — asks for confirmation
npm run db:restore -- backups/bitquest-20261111T140000Z.dump.gz

# Without prompt (automation scripts)
FORCE=1 npm run db:restore -- backups/latest.dump.gz
```

The restore uses `pg_restore --clean --if-exists`: it **DROPS** existing
objects before restoring. Use with caution on a DB
containing data you want to keep (create a backup first).

### Cron purge of expired MissionAttempt (LOT 22)

BitLab attempts (`MissionAttempt`) have a 2h TTL. Atomic transitions
on the API side already set them to EXPIRED on consumption, but
attempts never consumed (user closes their tab) remain `IN_PROGRESS`
indefinitely. A server-side batch cleans this queue.

**Endpoint**: `POST /api/cron/purge-expired-attempts`

**Auth**: header `X-Cron-Secret` matching `process.env.CRON_SECRET`
(≥ 16 characters, timing-safe comparison).

**Recommended system cron** (every 10 minutes):

```cron
# /etc/cron.d/bitquest-purge-attempts — every 10 min
*/10 * * * * curl -fsS -X POST -H "X-Cron-Secret: $CRON_SECRET" \
  http://localhost:3000/api/cron/purge-expired-attempts \
  >> /var/log/bitquest-purge.log 2>&1
```

**Response**:
```json
{ "ok": true, "expired": 3, "elapsedMs": 12 }
```

- `503` if `CRON_SECRET` absent or too short (route closed).
- `401` if header missing / incorrect.
- Idempotent: replaying the request = 0 expired after the first run.

---

## 5. Environment Variables

| Variable | Default | Role |
|---|---|---|
| `DATABASE_URL` | — | Postgres URL. If empty, scripts use `docker exec bitquest-db`. |
| `PG_CONTAINER` | `bitquest-db` | Container name for `docker exec` |
| `PG_USER` | `bitquest` | DB user for `pg_dump` / `pg_restore` |
| `PG_DB` | `bitquest` | DB name |
| `BACKUP_DIR` | `backups` | Output folder for dumps |
| `RETENTION` | `7` | Number of backups to keep (rotation) |
| `FORCE` | `0` | If `1`, skip confirmation prompt (restore) |
| `CRON_SECRET` | — | `X-Cron-Secret` header for `/api/cron/*` routes (≥ 16 chars, required in prod otherwise routes 503). |

---

## 6. Data Model — snapshot

> For full details, see `prisma/schema.prisma`. This section
> just lists models to quickly identify what is backed up.

Core: `User`, `Quest`, `QuizQuestion`, `UserQuestProgress`, `Badge`,
`UserBadge`, `UserEvent`, `DailyChallenge`, `UserChallengeCompletion`,
`EmailVerification`, `Session` (if present), `Account` (if present).

BitLab (PHASE_3): `BitLabProof`, `BitLabProofAttempt`.

Academy (ongoing LOT_1): `Course`, `Chapter`, `Lesson`.

Expected initial volume: < 100 MB for several thousand
learners. Compressed backup fits in a few MB.

---

## 7. Production Deployment Checklist

- [ ] `DATABASE_URL` in env **without** cleartext credentials in the repo.
- [ ] `CSRF_SECRET` + `BITLAB_JWT_SECRET` + `BITLAB_SIGN_SECRET` defined.
- [ ] `REDIS_URL` defined (otherwise rate-limit falls back to in-memory, not shared
      across instances).
- [ ] Postgres 16+ installed (compatible with Prisma 6).
- [ ] Backup cron active with `RETENTION` ≥ 14.
- [ ] Backups tested in restore (at least one dry-run per quarter).
- [ ] Monitoring size of `BitLabProofAttempt` and
      `UserEvent` tables (linear growth with usage).
