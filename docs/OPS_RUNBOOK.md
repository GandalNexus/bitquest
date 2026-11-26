# OPS RUNBOOK — BitQuest prod

> Ops executables: cron, secrets rotation, dashboards, alerts.
> BATCH 78. Complements `POSTGRES_PROD.md`, `SENTRY_OPS.md`,
> `RELEASE-READINESS.md`.

## 1. Secrets rotation

### 1a. Secrets inventory

| Variable | Role | Length | Recommended rotation |
|---|---|---|---|
| `CSRF_SECRET` | HMAC CSRF double-submit | ≥ 32B | 90d |
| `BITLAB_JWT_SECRET` | JWT mission challenge | ≥ 32B | 90d |
| `BITLAB_LAUNCH_SECRET` | SSO launch token | ≥ 32B | 90d |
| `BITLAB_SIGN_SECRET` | HMAC deep-link | ≥ 32B | 90d |
| `CERT_SIGN_SECRET` | HMAC Certificate v1 | ≥ 32B | 180d |
| `CERT_SIGN_PRIVKEY_HEX` | Schnorr v2 (BATCH 71) | 32B hex | **never** (permanent signature) |
| `CRON_SECRET` | Header /api/cron/* | ≥ 16B | 365d |
| `SENTRY_DSN` | Observability | — | never (provided by Sentry) |
| `DATABASE_URL` | Postgres | — | on DB reset |
| `REDIS_URL` | Redis | — | on Redis reset |
| `LND_MACAROON_HEX` | LND macaroon | — | per LND policy |

### 1b. JWT/HMAC rotation procedure (zero-downtime)

Tokens issued signed with the old secret will expire with their
natural TTL. Short-TTL flows (JWT challenge 10 min) are transparent.
For launch-token (60s) + CSRF (30d):

1. **Preparation** (d-7):
   - Generate `NEW_SECRET=$(openssl rand -hex 32)`.
   - Log in an ops manager (1Password / Vault).
2. **Rolling deployment**:
   - For each app server: set env `OLD_<SECRET>=<old>` +
     `<SECRET>=<new>`. The code accepts both (TODO future BATCH:
     dual-secret support; today rotation = 1 TTL cycle downtime).
3. **Purge** (d+1 TTL cycle): remove `OLD_<SECRET>`.
4. **Audit**: verify in Sentry that no `Invalid signature` warning
   remains.

**Note on Schnorr v2 (BATCH 71)**: `CERT_SIGN_PRIVKEY_HEX` must
**NEVER** be rotated — certificates already issued remain verifiable
with the NIP-11 published pubkey. A reset = all past v2 certificates
become invalid. If compromised: revoke the pubkey on the NIP side
and issue a new BitQuest instance.

## 2. Cron ops

### 2a. Cron purge expired MissionAttempt (BATCH 22)

```cron
# /etc/cron.d/bitquest-purge-attempts
*/10 * * * * www-data \
  curl -fsS -X POST \
    -H "X-Cron-Secret: $(cat /etc/bitquest/cron-secret)" \
    https://bitquest.example.com/api/cron/purge-expired-attempts \
  >> /var/log/bitquest-purge.log 2>&1
```

- Every 10 min.
- Secret file: `/etc/bitquest/cron-secret`, chmod 600, owned by www-data.
- Logs rotated by logrotate (see `/etc/logrotate.d/bitquest`).

### 2b. Cron Postgres backup (BATCH P1.1 scripts)

```cron
# /etc/cron.d/bitquest-backup
0 3 * * * www-data \
  cd /srv/bitquest && RETENTION=30 ./scripts/backup-postgres.sh \
  >> /var/log/bitquest-backup.log 2>&1

# Weekly off-site backup on Sunday at 4am
0 4 * * 0 www-data \
  cd /srv/bitquest && \
  rsync -az backups/ offsite-host:/backups/bitquest/ \
  >> /var/log/bitquest-backup.log 2>&1
```

- Daily 3am UTC with 30-day retention.
- Weekly 4am UTC → off-site.
- **Test restore monthly** on a staging env.

### 2c. Cron Postgres vacuum

```cron
# /etc/cron.d/bitquest-vacuum (Sunday 5am)
0 5 * * 0 postgres psql -U bitquest -d bitquest -c "VACUUM ANALYZE;" \
  >> /var/log/bitquest-vacuum.log 2>&1
```

## 3. Sentry dashboards

### 3a. "Operational health" dashboard (ADMIN)

Suggested metrics:
- **Error rate** (min 5m): alert if > 10/min.
- **BitLab proof success rate 24h**: alert if < 70%.
- **Lightning reward FAILED/PAID ratio**: alert if > 1.
- **Attestation CREATE_FAILED**: alert on 1 occurrence (anomaly).
- **Cron purge-attempts volume**: alert if > 100 expired attempts
  in one batch (anomaly, cf. BATCH 31 PURGE_ANOMALY_THRESHOLD).

### 3b. "Perf" dashboard

- p50/p95 `/api/bitlab/proof` (mempool TX verify).
- p50/p95 `/api/me/attestations/[id]/certificate` (crypto signing).
- p50/p95 `/api/certificates/verify` (public route).

### 3c. "Protocol" dashboard

- Request volume on `/api/version` (ecosystem pulse).
- v1 vs v2 ratio on `/api/certificates/verify` (Schnorr adoption).
- NIP-11 `/.well-known/nostr.json` volume (third-party integrations).

## 4. Incident runbook

### 4a. Postgres down

1. Sentry alert "DB ping failed" received.
2. `docker compose ps bitquest-db` → status.
3. If unhealthy: `docker compose restart bitquest-db`.
4. If data corrupted: restore from last backup (see
   `POSTGRES_PROD.md §Restore`).
5. Post-mortem: rotate macaroons/secrets if context compromised.

### 4b. LND Lightning down

1. Sentry alert `lightning reward LND failure` (BATCH 31).
2. Check `LND_REST_URL` reachable.
3. Temporarily disable: `LND_SEND_REWARDS_LIVE=0` + toggle
   `lightning.rewards` flag OFF via `/admin/feature-flags`.
4. Investigate failed rewards in DB (`/admin/lightning-rewards`).

### 4c. Attack / abuse

1. Rate-limit already in place on the app side (userId + IP).
2. If nonce replay abuse: check Redis up.
3. If `/api/certificates/verify` abuse: rate-limit IP 60/60s BATCH 29.
4. For any IP blocking: see reverse proxy (nginx/caddy), not at the
   app level.

## 5. External health checks

Pingdom/UptimeRobot recommended on:
- `GET /api/health` (DB + Redis): 1 min frequency.
- `GET /api/version` (static meta): 5 min frequency.
- `GET /.well-known/nostr.json` (NIP-11): 1h frequency.

v1 SLA thresholds:
- 99.5% uptime api/health.
- 1s p95 latency /api/health.
- 24h max before detecting a signaling incident.

## 6. References

- `POSTGRES_PROD.md`: detailed backup/restore procedure.
- `SENTRY_OPS.md`: Sentry activation + GDPR.
- `RELEASE-READINESS.md`: production go-day checklist.
- `TECHNICAL-DEBT.md`: debt ranked by priority.
