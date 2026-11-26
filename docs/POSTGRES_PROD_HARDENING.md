# PostgreSQL production hardening — BitQuest

**Date**: 2026-11-26
**Companion file**: [`docker-compose.prod.yml`](../docker-compose.prod.yml)
**Audit source**: see conversation 2026-11-26 for the full gap analysis.

This checklist exists because `docker-compose.dev.yml` is **not prod-safe**
and shouldn't be used in production. The application code (env validator,
CSRF, scrypt, PII redactions, Redis fail-closed, CORS strict) is already
hardened, but the infrastructure around it needs the steps below before
the first visitor hits the service.

Status legend : ✅ = done, ⚠️ = partial, ❌ = must fix before go-live.

---

## 1. Secrets (critical) ❌

### 1.1 Generate every secret separately

Each of the 5 app secrets and the 2 DB passwords must be **≥ 32 chars**,
random, and distinct. The env validator refuses anything shorter or any
value that looks like a placeholder (`placeholder*`, `change-me*`, or a
substring of another secret).

```bash
for key in \
    POSTGRES_SUPERUSER_PASSWORD \
    POSTGRES_APP_PASSWORD \
    REDIS_PASSWORD \
    CSRF_SECRET \
    BITLAB_JWT_SECRET \
    BITLAB_LAUNCH_SECRET \
    BITLAB_SIGN_SECRET \
    CERTIFICATE_SIGN_SECRET ; do
  echo "$key=$(openssl rand -hex 32)"
done
```

Copy the output into `.env.prod` (gitignored via `.env*` in `.gitignore`)
and store it twice offsite (password manager + encrypted backup).

### 1.2 Never commit a secret

- `.env.prod` must stay out of git — already covered by `.env*` in
  `.gitignore`, but double-check with `git check-ignore .env.prod`.
- No secret in CI logs : use masked variables in your runner.
- No secret in shell history : prefix with a space or use a one-shot
  file sourced with `source` then deleted.

### 1.3 Rotation policy

- Rotate all 8 secrets at minimum **every 180 days**, or immediately
  after any suspicion of compromise.
- JWT secrets (`BITLAB_*`) : rotating invalidates all in-flight launch
  tokens (TTL 60 s) and challenge JWTs (TTL 5 min). Browser tabs will
  hit a `/api/bitlab/proof` 401 and the UX recovers at the next refresh.
- `CERTIFICATE_SIGN_SECRET` : rotating breaks verification of all
  previously issued certificates. If you rotate, keep the previous key
  as `CERTIFICATE_SIGN_SECRET_PREVIOUS` and verify against both until
  all old certificates have expired.

---

## 2. Network exposure (critical) ❌

### 2.1 Postgres + Redis : zero host-side ports

`docker-compose.prod.yml` already omits the `ports:` section for both
services. They are reachable **only** from containers on the
`bitquest_internal` Docker network. Verify after deploy :

```bash
docker compose -f docker-compose.prod.yml ps --format "{{.Name}} {{.Ports}}"
# Expected :
# bitquest-app    127.0.0.1:3000->3000/tcp
# bitquest-db     (no mapping)
# bitquest-redis  (no mapping)
```

If you see `0.0.0.0:5432->5432/tcp` anywhere, abort and fix the compose
file — your DB is being scanned by Shodan already.

### 2.2 App : loopback-only, reverse proxy in front

The app binds on `127.0.0.1:3000`. Put Caddy / Nginx / Traefik in front
with TLS termination and HSTS. Minimal Caddyfile example :

```
bitquest.gandalnexus.com {
  reverse_proxy 127.0.0.1:3000
  encode zstd gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}
```

### 2.3 Host firewall

Enable UFW / nftables with only 443 (and 22 restricted to your admin
subnet) open inbound :

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 443/tcp
ufw allow from <admin-subnet>/32 to any port 22
ufw enable
```

---

## 3. Postgres role separation (critical) ❌

The container's `POSTGRES_USER` is a superuser (`Create role, Create DB,
Replication, Bypass RLS`). The app must NOT connect with that role.

### 3.1 Create a non-superuser app role

Run **once** after the first `docker compose up` :

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres \
  psql -U "$POSTGRES_SUPERUSER" -d "$POSTGRES_DB" <<SQL
CREATE ROLE ${POSTGRES_APP_USER:-bitquest_app}
  LOGIN
  PASSWORD '${POSTGRES_APP_PASSWORD}'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION;

GRANT CONNECT ON DATABASE ${POSTGRES_DB:-bitquest} TO ${POSTGRES_APP_USER:-bitquest_app};
GRANT USAGE ON SCHEMA public TO ${POSTGRES_APP_USER:-bitquest_app};

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES
  IN SCHEMA public TO ${POSTGRES_APP_USER:-bitquest_app};
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES
  IN SCHEMA public TO ${POSTGRES_APP_USER:-bitquest_app};

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${POSTGRES_APP_USER:-bitquest_app};
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${POSTGRES_APP_USER:-bitquest_app};
SQL
```

Verify :

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U "$POSTGRES_SUPERUSER" -d bitquest -c "\du ${POSTGRES_APP_USER:-bitquest_app}"
# Expected : no `Superuser`, no `Create *`, just `Login` (empty Attributes).
```

### 3.2 Migrations

`prisma migrate deploy` creates tables + indexes — it needs the
superuser (or at minimum `CREATEDB` + ownership). Run migrations as the
superuser, then rotate the app connection back to `POSTGRES_APP_USER` :

```bash
# One-shot, as superuser
docker compose --env-file .env.prod -f docker-compose.prod.yml \
  run --rm -e DATABASE_URL="postgresql://${POSTGRES_SUPERUSER}:${POSTGRES_SUPERUSER_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  app npx prisma migrate deploy

# Regular runtime : uses POSTGRES_APP_USER via the main service
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d app
```

---

## 4. TLS to the database ⚠️

Inside the Docker network the traffic is container-to-container and
unavailable from the outside, so TLS is not strictly required. **But**
as soon as the DB moves off-host (managed Postgres, remote VM, cross-AZ),
flip to `sslmode=require` :

```
DATABASE_URL=postgresql://user:pwd@host:5432/db?sslmode=require&connect_timeout=5
```

For managed providers (Neon, Supabase, Aiven, RDS…) `sslmode=verify-full`
is preferred — add `sslrootcert=/path/to/ca.pem` and bundle the CA inside
the container image.

---

## 5. Redis hardening ✅ (compose already covers it)

Already enforced in `docker-compose.prod.yml` :
- `--requirepass ${REDIS_PASSWORD}` : every command refuses without auth.
- No `ports:` section : only the app container reaches Redis.
- `maxmemory 256mb` + `allkeys-lru` eviction : bounded memory, LRU under pressure.
- No persistence (`--save ""`, `--appendonly no`) : our usage is ephemeral
  (rate-limit, anti-replay nonces, sessions). If you want to survive
  restarts, set `--save 60 1000` and mount `redis_data`.

Verify from outside the container :

```bash
# Should FAIL (connection refused)
redis-cli -h <host> -p 6379 ping

# Should FAIL (NOAUTH)
docker compose -f docker-compose.prod.yml exec redis redis-cli ping

# Should SUCCEED (PONG)
docker compose --env-file .env.prod -f docker-compose.prod.yml exec redis \
  redis-cli -a "$REDIS_PASSWORD" ping
```

---

## 6. Backups ⚠️

A ready-to-run cron is included in the compose under profile `backup`.
Enable it :

```bash
mkdir -p backups
docker compose --env-file .env.prod -f docker-compose.prod.yml \
  --profile backup up -d backup
```

This writes `backups/bitquest-<utc-timestamp>.dump.gz` every day at
03:15 UTC and keeps the last `BACKUP_RETENTION` files (default 14).

### 6.1 Offsite copy — not optional

The container keeps backups on the SAME DISK as the DB. If the host
dies, the backups die with it. Add an offsite copy :

```bash
# AWS S3 (install awscli, configure a scoped IAM role)
0 4 * * *  aws s3 sync /opt/bitquest/backups/ s3://bitquest-backups/ \
             --storage-class STANDARD_IA --exclude "*" --include "*.dump.gz"

# Backblaze B2 (install b2 cli)
0 4 * * *  b2 sync /opt/bitquest/backups/ b2://bitquest-backups/

# rclone to any provider
0 4 * * *  rclone sync /opt/bitquest/backups/ remote:bitquest-backups/
```

### 6.2 Recovery drill (every 3 months)

A backup you can't restore is not a backup. Quarterly, on a staging
host :

```bash
# 1. Pick an actual production dump
DUMP=backups/bitquest-20261120T031500Z.dump.gz

# 2. Spin up a fresh Postgres from the compose on a staging VM
docker compose --env-file .env.staging -f docker-compose.prod.yml \
  up -d postgres

# 3. Restore via the included script
DATABASE_URL="postgresql://..." ./scripts/restore-postgres.sh "$DUMP"

# 4. Smoke-check row counts, latest audit log entry, a known user :
docker compose exec postgres psql -U "$POSTGRES_SUPERUSER" -d bitquest <<SQL
  SELECT count(*) FROM "User";
  SELECT count(*) FROM "AdminAuditLog";
  SELECT max("createdAt") FROM "AdminAuditLog";
SQL

# 5. Document the drill result in docs/OPS_RUNBOOK.md with the date.
```

---

## 7. Observability ⚠️

### 7.1 Already shipped

- `/api/health` : lightweight DB + Redis ping, 200 OK if both reachable.
  Wire into your uptime monitor (UptimeRobot, BetterStack, Oh Dear).
- Pino structured logs with PII redactions (`src/lib/log.ts`).
- Sentry client + server, no-op if `SENTRY_DSN` empty (set it in prod).
- Admin audit log table `AdminAuditLog` with 30+ tracked actions.

### 7.2 To add before scale

- **pgBouncer** between the app and Postgres once concurrency grows past
  a few hundred RPS. Prisma holds connections long, pgBouncer in
  transaction mode fixes the fan-out.
- **Postgres metrics** via `postgres_exporter` → Prometheus → Grafana
  (or managed equivalent). Watch : connection count, lock waits, slow
  queries (already logged above 500 ms via the compose command flags).
- **Redis metrics** via `redis_exporter` similarly. Watch : evicted
  keys (should stay near 0), memory fragmentation ratio.

---

## 8. Row-level security (future work) ❌

Prisma does not yet drive RLS natively, and BitQuest currently enforces
authorisation in-app (roles APPRENTICE / EDITOR / ADMIN, checked on
every API route). This is sufficient for the current trust boundary
(single tenant, single Postgres), but if you ever expose read-only
replicas to third parties, enable RLS policies on `User` /
`UserQuestProgress` / `BitLabProof` and verify via unit tests before
flipping.

---

## 9. Pre-launch verification script

Run this before announcing the service :

```bash
#!/usr/bin/env bash
# ops/preflight.sh — run from the prod host.
set -euo pipefail

echo "[1] Compose services healthy"
docker compose --env-file .env.prod -f docker-compose.prod.yml ps \
  | grep -E "(app|postgres|redis)" \
  | awk '{print $NF}' \
  | grep -q "healthy"

echo "[2] No DB / Redis port leaks on host"
! ss -tln | grep -qE ":(5432|6379)\b"

echo "[3] App role has no superuser"
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_SUPERUSER" -d "$POSTGRES_DB" -tAc \
    "SELECT rolsuper FROM pg_roles WHERE rolname = '$POSTGRES_APP_USER'" \
  | grep -qx "f"

echo "[4] Redis refuses NOAUTH"
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T redis \
  redis-cli ping 2>&1 | grep -qi "NOAUTH"

echo "[5] /api/health returns 200"
curl -fsS http://127.0.0.1:3000/api/health >/dev/null

echo "[6] Env validator ran clean"
docker compose --env-file .env.prod -f docker-compose.prod.yml logs app \
  | grep -q "env validator : aucune anomalie détectée"

echo "[7] CORS strict (BITLAB_ALLOWED_ORIGINS is set, no wildcard)"
grep -E "^BITLAB_ALLOWED_ORIGINS=" .env.prod | grep -qvE "(\*|localhost)"

echo "[8] TLS terminated at the reverse proxy"
curl -sI https://bitquest.gandalnexus.com/ | grep -q "HTTP/2 200"

echo "✅ all checks passed"
```

---

## 10. Dev → prod cutover summary

| Area | Dev (`docker-compose.dev.yml`) | Prod (`docker-compose.prod.yml`) |
|------|--------------------------------|-----------------------------------|
| Postgres password | `bitquest_dev_password` (hardcoded) | `POSTGRES_SUPERUSER_PASSWORD` env, `openssl rand -hex 32` |
| Postgres port | `0.0.0.0:5432` exposed | internal network only |
| Postgres user | superuser | separate `bitquest_app` role, no superuser |
| Redis auth | none (`requirepass` empty) | `REDIS_PASSWORD` required |
| Redis port | `0.0.0.0:6379` exposed | internal network only |
| App env secrets | optional (fallback in-memory) | validated at boot, refuse to start if weak |
| CORS | permissive fallback | strict allow-list required |
| Backups | manual | daily container cron + offsite |
| HTTPS | — | reverse proxy + HSTS |
| Monitoring | — | `/api/health` + Sentry + uptime |

Keep both files in sync in intent but **never** swap one for the other.
