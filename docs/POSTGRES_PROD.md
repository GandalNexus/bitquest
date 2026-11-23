# Production PostgreSQL — BitQuest

**Date** : 2026-11-11
**Statut** : Postgres est la DB production **et** dev depuis la Phase 0.4.
Le fichier `db/custom.db` (SQLite) est un vestige historique conservé pour
récupération éventuelle, mais plus utilisé par l'application.

---

## 1. Contexte

- `prisma/schema.prisma` déclare `provider = "postgresql"`.
- 4 migrations versionnées sous `prisma/migrations/` :
  - `20261110221940_init`
  - `20261110230829_add_bitlab_proof`
  - `20261110232859_add_quest_mission_kind`
  - `20261110233500_add_email_verification`
- `docker-compose.yml` fournit un service `postgres` (image `postgres:16-alpine`).
- `docker-compose.dev.yml` branche l'app de dev sur ce même Postgres via le
  container `bitquest-db`.

**Donc** : ni en dev ni en prod, aucune ligne de code ne touche SQLite.
`db/custom.db` et ses backups (`custom.db.bak-*`) ne sont **jamais** lus par
l'application actuelle.

---

## 2. Commandes npm

| Commande | Rôle |
|---|---|
| `npm run db:generate` | Génère le client Prisma (après modif `schema.prisma`) |
| `npm run db:migrate` | `prisma migrate dev` — crée/applique une migration en dev |
| `npm run db:migrate:deploy` | `prisma migrate deploy` — applique les migrations existantes sans créer d'en nouvelle (prod) |
| `npm run db:push` | `prisma db push --accept-data-loss` — à éviter en prod |
| `npm run db:reset` | ⚠️  Reset complet (dev uniquement, destructif) |
| `npm run db:seed` | Seed initial (`prisma/seed.ts`) |
| `npm run db:backup` | Dump horodaté + gzip dans `backups/` + rotation 7 (default) |
| `npm run db:restore -- <fichier>` | Restaure depuis un `.dump.gz` (demande confirmation) |

---

## 3. Déploiement en production

### Première installation

```bash
# 1. Démarrer Postgres
docker compose up -d postgres

# 2. Appliquer les migrations existantes (ne tente pas d'en créer de nouvelles)
DATABASE_URL="postgresql://user:pass@host:5432/bitquest" \
  npm run db:migrate:deploy

# 3. Seed initial (optionnel — contenu pédagogique de départ)
DATABASE_URL="postgresql://..." npm run db:seed
```

### Mise à jour (déploiement continu)

```bash
# Depuis le repo à jour
DATABASE_URL="..." npm run db:migrate:deploy
```

`migrate deploy` est **idempotent** : il applique les migrations en attente
et ne touche à rien si tout est déjà à jour.

---

## 4. Backup / Restore

### Backup quotidien

```bash
# Via docker (default — utilise le container bitquest-db)
npm run db:backup

# Via host (pg_dump installé localement, DATABASE_URL custom)
DATABASE_URL="..." npm run db:backup

# Rétention : garder 14 derniers (default 7)
RETENTION=14 npm run db:backup
```

Produit `backups/bitquest-<timestamp>.dump.gz` au format pg_dump custom
(compatible `pg_restore`, portabilité entre versions Postgres 15+).

**Pour un cron système** :

```cron
# /etc/cron.d/bitquest-backup — tous les jours à 3h UTC
0 3 * * * cd /srv/bitquest && /usr/bin/env RETENTION=30 ./scripts/backup-postgres.sh >> /var/log/bitquest-backup.log 2>&1
```

### Restore

```bash
# Depuis un fichier backup — demande confirmation
npm run db:restore -- backups/bitquest-20261111T140000Z.dump.gz

# Sans prompt (scripts d'automation)
FORCE=1 npm run db:restore -- backups/latest.dump.gz
```

⚠️  Le restore utilise `pg_restore --clean --if-exists` : il **DROP** les
objets existants avant de restaurer. À utiliser avec précaution sur une DB
contenant des données qu'on veut conserver (créer un backup avant).

### Cron purge MissionAttempt expirés (LOT 22)

Les tentatives BitLab (`MissionAttempt`) ont un TTL de 2h. Les transitions
atomiques côté API mettent déjà à EXPIRED à la consommation, mais les
attempts jamais consommés (user ferme son onglet) restent en `IN_PROGRESS`
indéfiniment. Un batch côté serveur nettoie cette file.

**Endpoint** : `POST /api/cron/purge-expired-attempts`

**Auth** : header `X-Cron-Secret` qui matche `process.env.CRON_SECRET`
(≥ 16 caractères, comparaison timing-safe).

**Cron système recommandé** (toutes les 10 minutes) :

```cron
# /etc/cron.d/bitquest-purge-attempts — toutes les 10 min
*/10 * * * * curl -fsS -X POST -H "X-Cron-Secret: $CRON_SECRET" \
  http://localhost:3000/api/cron/purge-expired-attempts \
  >> /var/log/bitquest-purge.log 2>&1
```

**Réponse** :
```json
{ "ok": true, "expired": 3, "elapsedMs": 12 }
```

- `503` si `CRON_SECRET` absent ou trop court (route fermée).
- `401` si header manquant / incorrect.
- Idempotent : rejouer la requête = 0 expired après le premier run.

---

## 5. Variables d'environnement

| Variable | Default | Rôle |
|---|---|---|
| `DATABASE_URL` | — | URL Postgres. Si vide, les scripts utilisent `docker exec bitquest-db`. |
| `PG_CONTAINER` | `bitquest-db` | Nom du container pour `docker exec` |
| `PG_USER` | `bitquest` | User DB pour `pg_dump` / `pg_restore` |
| `PG_DB` | `bitquest` | Nom de la DB |
| `BACKUP_DIR` | `backups` | Dossier de sortie des dumps |
| `RETENTION` | `7` | Nombre de backups à conserver (rotation) |
| `FORCE` | `0` | Si `1`, skip le prompt de confirmation (restore) |
| `CRON_SECRET` | — | Header `X-Cron-Secret` pour routes `/api/cron/*` (≥ 16 chars, requis en prod sinon routes 503). |

---

## 6. Modèle de données — snapshot

> Pour les détails complets, voir `prisma/schema.prisma`. Cette section
> liste juste les modèles afin d'identifier rapidement ce qui est backup-é.

Core : `User`, `Quest`, `QuizQuestion`, `UserQuestProgress`, `Badge`,
`UserBadge`, `UserEvent`, `DailyChallenge`, `UserChallengeCompletion`,
`EmailVerification`, `Session` (si présent), `Account` (si présent).

BitLab (Phase 3) : `BitLabProof`, `BitLabProofAttempt`.

Académie (en cours Lot 1) : `Course`, `Chapter`, `Lesson`.

Volumétrie attendue initiale : < 100 MB pour plusieurs milliers
d'apprenants. Le backup compressé tient dans quelques Mo.

---

## 7. Checklist de mise en production

- [ ] `DATABASE_URL` en env **sans** credentials en clair dans le repo.
- [ ] `CSRF_SECRET` + `BITLAB_JWT_SECRET` + `BITLAB_SIGN_SECRET` définis.
- [ ] `REDIS_URL` défini (sinon rate-limit retombe en in-memory, non partagé
      entre instances).
- [ ] Postgres 16+ installé (compatible Prisma 6).
- [ ] Cron de backup actif avec `RETENTION` ≥ 14.
- [ ] Backups testés en restore (au moins un dry-run par trimestre).
- [ ] Monitoring de la taille des tables `BitLabProofAttempt` et
      `UserEvent` (croissance linéaire avec l'usage).
