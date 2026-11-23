# Environnement de développement Docker — BitQuest

> Ce document décrit l'environnement de développement reproductible pour BitQuest,
> basé sur Docker. Depuis la Phase 0.4, la base de données principale est
> **PostgreSQL** (service `postgres` dans `docker-compose.dev.yml`). Le fichier
> `db/custom.db` SQLite est un vestige historique conservé pour récupération
> éventuelle mais plus utilisé par l'application. Pour les opérations prod
> (migrations, backup/restore), voir [`POSTGRES_PROD.md`](POSTGRES_PROD.md).

---

## 1. Objectif

- Isoler les dépendances Node.js du Mac host.
- Rendre reproductible la toolchain (Node 20, Prisma 6, Next.js 16, Postgres 16, Redis 7).
- Permettre le hot-reload (HMR) lors des modifications locales.
- Fournir un Postgres local prêt à l'emploi (bind mount du volume `postgres_data`).

---

## 2. Fichiers associés

| Fichier | Rôle |
|---|---|
| `Dockerfile.dev` | Image de dev basée sur `node:20-bookworm-slim` |
| `docker-compose.dev.yml` | Orchestration : service unique, volumes nommés pour `node_modules` et `.next`, bind mount pour le code et la base SQLite |
| `.dockerignore` | Contexte de build minimal (n'efface aucun fichier du dépôt) |

Le fichier `docker-compose.yml` (PostgreSQL seul) est utilisable comme alternative
minimale si on veut juste Postgres sans l'app.

---

## 3. Prérequis

- Docker Desktop ≥ 20.10 (testé sous Docker 24).
- Docker Compose v2.

---

## 4. Modèle de persistance

| Chemin host | Chemin conteneur | Type | Rôle |
|---|---|---|---|
| `./` | `/app` | bind mount (cached) | Code source, édition live depuis macOS |
| (volume nommé) | `/app/node_modules` | volume Docker `bitquest_node_modules` | Binaires natifs Linux, isolés du host |
| (volume nommé) | `/app/.next` | volume Docker `bitquest_next_cache` | Cache Next.js persistant entre redémarrages |
| (volume nommé) | `/var/lib/postgresql/data` (container `bitquest-db`) | volume Docker `bitquest_postgres_data` | **Données Postgres** persistantes |
| `./db` | `/app/db` | bind mount | Vestige SQLite (`custom.db` + backups). Non lu par l'app. |

**Garantie** : le volume `bitquest_postgres_data` est préservé entre
`docker compose down` et `up`. Pour le supprimer explicitement :
`docker compose down -v` (destructif).

---

## 5. Variables d'environnement injectées

| Variable | Valeur | Raison |
|---|---|---|
| `NODE_ENV` | `development` | Standard Next.js |
| `DATABASE_URL` | `postgresql://bitquest:bitquest_dev_password@postgres:5432/bitquest?schema=public` | Postgres via le service compose |
| `REDIS_URL` | `redis://redis:6379` | Rate-limit distribué (fallback in-memory si service down) |
| `CHOKIDAR_USEPOLLING` | `true` | HMR fiable avec bind mount macOS |
| `WATCHPACK_POLLING` | `true` | Webpack/Turbopack watch sur bind mount |
| `NEXT_TELEMETRY_DISABLED` | `1` | Évite l'appel réseau Next télémétrie |

**Pas besoin de créer un `.env` sur le host** : le compose fournit tout.

---

## 6. Commandes

### 6.1 Premier démarrage (une seule fois)

```bash
# 1. Construire l'image
docker compose -f docker-compose.dev.yml build

# 2. Installer les dépendances dans le volume dédié (long, ~1-3 min)
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npm ci

# 3. Générer le client Prisma (indispensable avant de démarrer Next)
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npx prisma generate
```

### 6.2 Démarrage quotidien

```bash
# Démarrer le serveur de dev (port 3000)
docker compose -f docker-compose.dev.yml up

# OU en arrière-plan
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml logs -f bitquest-dev
```

L'application est accessible sur `http://localhost:3000`.

### 6.3 Arrêt

```bash
# Arrêt (conserve volumes)
docker compose -f docker-compose.dev.yml down

# Arrêt + suppression des volumes (⚠ perd le cache .next et node_modules)
docker compose -f docker-compose.dev.yml down -v
# ⚠ db/custom.db NE sera PAS supprimée (c'est un bind mount, pas un volume)
```

### 6.4 Commandes de contrôle qualité (sur conteneur en marche)

```bash
# ESLint + oxlint
docker compose -f docker-compose.dev.yml exec bitquest-dev npm run lint

# Vérification TypeScript
docker compose -f docker-compose.dev.yml exec bitquest-dev npx tsc --noEmit

# Tests Vitest (nécessite la correction de vitest.config.ts prévue en Phase 0)
docker compose -f docker-compose.dev.yml exec bitquest-dev npx vitest run

# Build Next.js
docker compose -f docker-compose.dev.yml exec bitquest-dev npm run build

# Formatage Prettier
docker compose -f docker-compose.dev.yml exec bitquest-dev npm run format
```

### 6.5 Commandes "one-shot" (sans démarrer le serveur)

```bash
# Idéal pour CI locale ou vérif ponctuelle
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npm run lint
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npx tsc --noEmit
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npx vitest run
```

### 6.6 Shell interactif

```bash
docker compose -f docker-compose.dev.yml exec bitquest-dev bash
# dans le conteneur :
# node --version
# npm --version
# npx prisma --version
# ls -la db/
```

### 6.7 Prisma (opérations LECTURE SEULE pour la Phase 0)

```bash
# Générer le client (safe)
docker compose -f docker-compose.dev.yml exec bitquest-dev npx prisma generate

# Introspecter la base existante (safe)
docker compose -f docker-compose.dev.yml exec bitquest-dev npx prisma db pull
```

**NE PAS exécuter en Phase 0** (destructif ou structurellement risqué) :

```bash
# ⛔ Modifie la base
# npx prisma db push
# npx prisma migrate dev
# npx prisma migrate reset
```

Ces commandes seront discutées en phase suivante après validation explicite.

---

## 7. Hot Module Replacement (HMR)

Le HMR est activé par polling (`CHOKIDAR_USEPOLLING=true`) pour fiabiliser la détection de fichiers sur macOS via Docker Desktop.

- Modifier un fichier `src/**/*.tsx` → recompilation automatique.
- Vérifier dans les logs : `docker compose -f docker-compose.dev.yml logs -f bitquest-dev`.
- Attendu : lignes `✓ Compiled in …` ou `Compiling /...`.

Si le HMR ne déclenche pas :
1. Vérifier que `CHOKIDAR_USEPOLLING=true` est bien injecté : `docker compose -f docker-compose.dev.yml exec bitquest-dev env | grep POLLING`.
2. Vérifier que le bind mount est actif : `docker compose -f docker-compose.dev.yml exec bitquest-dev ls -la /app/src/app/page.tsx` (doit refléter la dernière modification).

---

## 8. Dépannage

### 8.1 `EACCES` ou permissions sur `node_modules`

Cause : volume nommé créé par un user différent lors d'un essai précédent.

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npm ci
```

### 8.2 Erreur Prisma `Can't reach database server`

Cause : `DATABASE_URL` mal interprété.

```bash
# Vérifier
docker compose -f docker-compose.dev.yml exec bitquest-dev env | grep DATABASE_URL
# Attendu : file:/app/db/custom.db

# Vérifier que la base existe DANS le conteneur
docker compose -f docker-compose.dev.yml exec bitquest-dev ls -la /app/db/
# Attendu : custom.db présent
```

### 8.3 Port 3000 occupé sur le Mac

```bash
# Trouver le process
lsof -i :3000

# OU changer le port host dans docker-compose.dev.yml :
# ports:
#   - "3001:3000"
```

### 8.4 Reset complet (dernier recours)

```bash
docker compose -f docker-compose.dev.yml down -v
docker rmi bitquest-dev 2>/dev/null
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npm ci
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npx prisma generate
```

`db/custom.db` est préservée (bind mount, non volume).

---

## 9. Hors périmètre de ce document

- Image de production (sera traitée après la migration PostgreSQL).
- Image CI (phase 0 utilisera GitHub Actions avec `node:20`, sans Docker).
- PostgreSQL (`docker-compose.yml` d'origine). Conservé mais non utilisé dans ce flux.

---

## 10. Validation attendue

Après `docker compose -f docker-compose.dev.yml up`, tu dois pouvoir :

- [ ] Ouvrir `http://localhost:3000` depuis Safari/Chrome sur le Mac.
- [ ] Voir la page d'accueil BitQuest (ou l'écran d'auth).
- [ ] Modifier `src/app/page.tsx` depuis macOS et voir la recompilation automatique.
- [ ] Vérifier que `db/custom.db` conserve sa taille / date initiale.
- [ ] Exécuter `npm run lint` dans le conteneur sans erreur réseau.

Si l'une de ces cases échoue, voir la section Dépannage.
