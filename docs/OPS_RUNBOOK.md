# OPS RUNBOOK — BitQuest prod

> Exécutables ops : cron, rotation secrets, dashboards, alertes.
> LOT 78. Complète `POSTGRES_PROD.md`, `SENTRY_OPS.md`,
> `RELEASE-READINESS.md`.

## 1. Secrets rotation

### 1a. Inventaire des secrets

| Variable | Rôle | Longueur | Rotation recommandée |
|---|---|---|---|
| `CSRF_SECRET` | HMAC CSRF double-submit | ≥ 32B | 90j |
| `BITLAB_JWT_SECRET` | JWT challenge mission | ≥ 32B | 90j |
| `BITLAB_LAUNCH_SECRET` | Launch token SSO | ≥ 32B | 90j |
| `BITLAB_SIGN_SECRET` | HMAC deep-link | ≥ 32B | 90j |
| `CERT_SIGN_SECRET` | HMAC Certificate v1 | ≥ 32B | 180j |
| `CERT_SIGN_PRIVKEY_HEX` | Schnorr v2 (LOT 71) | 32B hex | **jamais** (signature permanente) |
| `CRON_SECRET` | Header /api/cron/* | ≥ 16B | 365j |
| `SENTRY_DSN` | Observabilité | — | jamais (fourni par Sentry) |
| `DATABASE_URL` | Postgres | — | lors de reset DB |
| `REDIS_URL` | Redis | — | lors de reset Redis |
| `LND_MACAROON_HEX` | Macaroon LND | — | selon LND policy |

### 1b. Procédure rotation JWT/HMAC (zero-downtime)

Les tokens émis signés avec l'ancien secret vont expirer avec leur
TTL naturel. Les flows à TTL court (JWT challenge 10 min) sont
transparents. Pour launch-token (60s) + CSRF (30j) :

1. **Préparation** (j-7) :
   - Générer `NEW_SECRET=$(openssl rand -hex 32)`.
   - Logger dans un gestionnaire ops (1Password / Vault).
2. **Déploiement rolling** :
   - Pour chaque serveur app : set env `OLD_<SECRET>=<ancien>` +
     `<SECRET>=<nouveau>`. Le code accepte les 2 (TODO LOT futur :
     dual-secret support ; aujourd'hui rotation = downtime 1 cycle TTL).
3. **Purge** (j+1 cycle TTL) : retirer `OLD_<SECRET>`.
4. **Audit** : vérifier dans Sentry qu'aucun warning
   `Signature invalide` ne subsiste.

**Note sur Schnorr v2 (LOT 71)** : `CERT_SIGN_PRIVKEY_HEX` ne doit
**JAMAIS** être roté — les certificats déjà émis restent vérifiables
avec la pubkey publiée NIP-11. Un reset = tous les certifs v2 passés
deviennent invalides. Si compromis : révoquer la pubkey côté NIP
et émettre une nouvelle instance BitQuest.

## 2. Cron ops

### 2a. Cron purge MissionAttempt expirés (LOT 22)

```cron
# /etc/cron.d/bitquest-purge-attempts
*/10 * * * * www-data \
  curl -fsS -X POST \
    -H "X-Cron-Secret: $(cat /etc/bitquest/cron-secret)" \
    https://bitquest.example.com/api/cron/purge-expired-attempts \
  >> /var/log/bitquest-purge.log 2>&1
```

- Toutes les 10 min.
- Fichier secret : `/etc/bitquest/cron-secret`, chmod 600, owned by www-data.
- Logs rotés par logrotate (voir `/etc/logrotate.d/bitquest`).

### 2b. Cron backup Postgres (scripts LOT P1.1)

```cron
# /etc/cron.d/bitquest-backup
0 3 * * * www-data \
  cd /srv/bitquest && RETENTION=30 ./scripts/backup-postgres.sh \
  >> /var/log/bitquest-backup.log 2>&1

# Backup hebdomadaire off-site le dimanche à 4h
0 4 * * 0 www-data \
  cd /srv/bitquest && \
  rsync -az backups/ offsite-host:/backups/bitquest/ \
  >> /var/log/bitquest-backup.log 2>&1
```

- Quotidien 3h UTC avec rétention 30 jours.
- Hebdomadaire 4h UTC → off-site.
- **Tester la restauration mensuellement** sur un env staging.

### 2c. Cron vacuum Postgres

```cron
# /etc/cron.d/bitquest-vacuum (dimanche 5h)
0 5 * * 0 postgres psql -U bitquest -d bitquest -c "VACUUM ANALYZE;" \
  >> /var/log/bitquest-vacuum.log 2>&1
```

## 3. Dashboards Sentry

### 3a. Dashboard « Santé opérationnelle » (ADMIN)

Metrics suggérés :
- **Erreur rate** (min 5m) : alerte si > 10/min.
- **BitLab proof success rate 24h** : alerte si < 70%.
- **Lightning reward FAILED/PAID ratio** : alerte si > 1.
- **Attestation CREATE_FAILED** : alerte sur 1 occurrence (anomalie).
- **Cron purge-attempts volume** : alerte si > 100 attempts expirés
  en un batch (anomalie, cf. LOT 31 PURGE_ANOMALY_THRESHOLD).

### 3b. Dashboard « Perf »

- p50/p95 `/api/bitlab/proof` (verif TX mempool).
- p50/p95 `/api/me/attestations/[id]/certificate` (crypto signing).
- p50/p95 `/api/certificates/verify` (route publique).

### 3c. Dashboard « Protocole »

- Volume de requêtes `/api/version` (pulse écosystème).
- Taux v1 vs v2 dans `/api/certificates/verify` (adoption Schnorr).
- Volume NIP-11 `/.well-known/nostr.json` (intégrations tierces).

## 4. Runbook incidents

### 4a. Postgres down

1. Alerte Sentry « DB ping failed » reçue.
2. `docker compose ps bitquest-db` → statut.
3. Si unhealthy : `docker compose restart bitquest-db`.
4. Si données corrompues : restore du dernier backup (voir
   `POSTGRES_PROD.md §Restore`).
5. Post-mortem : rotation macaroons/secrets si contexte compromis.

### 4b. LND Lightning down

1. Alerte Sentry `lightning reward LND failure` (LOT 31).
2. Vérifier `LND_REST_URL` accessible.
3. Désactiver temporairement : `LND_SEND_REWARDS_LIVE=0` + toggle
   flag `lightning.rewards` OFF via `/admin/feature-flags`.
4. Investiguer les failed rewards en base (`/admin/lightning-rewards`).

### 4c. Attack / abus

1. Rate-limit déjà en place côté app (userId + IP).
2. Si abus nonce replay : vérifier Redis up.
3. Si abus `/api/certificates/verify` : rate-limit IP 60/60s LOT 29.
4. Pour tout blocage IP : cf. reverse proxy (nginx/caddy), pas au
   niveau app.

## 5. Health checks externes

Pingdom/UptimeRobot recommandé sur :
- `GET /api/health` (DB + Redis) : fréquence 1 min.
- `GET /api/version` (meta static) : fréquence 5 min.
- `GET /.well-known/nostr.json` (NIP-11) : fréquence 1h.

Seuils SLA v1 :
- 99.5% uptime api/health.
- 1s p95 latence /api/health.
- 24h max avant détection d'un signaling incident.

## 6. Références

- `POSTGRES_PROD.md` : procédure backup/restore détaillée.
- `SENTRY_OPS.md` : activation Sentry + RGPD.
- `RELEASE-READINESS.md` : checklist jour-J prod.
- `TECHNICAL-DEBT.md` : dette classée par priorité.
