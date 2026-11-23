# BitQuest

![Bitcoin](https://img.shields.io/badge/Bitcoin-FF9900?style=flat-square&logo=bitcoin&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js%2016-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg?style=flat-square)

**Plateforme éducative gamifiée pour apprendre Bitcoin et le Lightning Network.**

BitQuest est l'un des deux volets de [GandalNexus](https://github.com/GandalNexus) (projet sénégalais récompensé au Dakar Bitcoin Hack 2025) : le module **learn → practice → earn** pour accompagner les apprenants, débutants comme avancés, dans la découverte progressive de Bitcoin. Le volet pratique est assuré par le projet frère [BitLab](https://github.com/GandalNexus/bitlab).

## Vue d'ensemble

BitQuest propose un parcours structuré de quêtes thématiques alliant théorie, mini-quiz et missions pratiques. L'engagement est récompensé par de l'XP, des badges et des satoshis **symboliques** (voir avertissement ci-dessous).

### Les quêtes

Chaque quête est composée de :

1. **Une introduction** avec contexte et objectifs pédagogiques.
2. **Des sections théoriques** structurées (texte + points clés).
3. **Un quiz** à réussir à 70 % minimum pour débloquer la suite.
4. **Une mission pratique** (8 types disponibles : exploration de bloc, forge de clés, construction de transaction, minage d'un nonce, ouverture d'un canal Lightning, parsing BOLT11, multisig, tweak Taproot).
5. **Une récompense** : XP et sats pédagogiques.

> ⚠️ **Les satoshis distribués par BitQuest sont des points pédagogiques**, pas des satoshis réels. Aucun transfert on-chain, aucun paiement Lightning réel n'est effectué dans cette version. L'intégration Lightning réelle via BitLab est prévue pour les phases ultérieures (voir `docs/BITQUEST_ROADMAP.md`).

### Fonctionnalités actuelles (v0.3)

- **Authentification** sécurisée : cookie HttpOnly `bq_session`, CSRF
  double-submit HMAC, mot de passe (`scrypt`), vérification email (fondation),
  soft-delete RGPD avec anonymisation PII.
- **Rôles** `APPRENTICE` / `EDITOR` / `ADMIN` + helpers `requireRole*` côté API
  et SSR.
- **Dashboard** avec anneau de niveau, statistiques, timeline, onboarding
  et teaser Académie.
- **11 quêtes** seedées, réparties sur 4 pistes (initiation, intermédiaire,
  avancée, spéciale). 8 types de missions.
- **Académie** : cours → chapitres → leçons markdown avec suivi de complétion.
- **Défi du jour** avec récompenses XP + sats.
- **15 badges** (7 types de conditions).
- **Classement** des 20 meilleurs apprenants.
- **Portefeuille pédagogique** + historique.
- **Admin console** complète : CRUD cours, quêtes (métadonnées + théorie +
  quiz + type de mission), badges, défis du jour, utilisateurs (rôles),
  purge RGPD, audit log (24+ actions).
- **BitLab foundation** (Phase 3) : modèle `BitLabProof`, `MempoolClient`
  (mempool.space + fallback blockstream), endpoint `/api/bitlab/proof`
  (`TX` ou `INVOICE`), décodage BOLT11, JWT challenge/nonce anti-replay via
  Redis. Quête pilote `tx-basics` câblée sur `BITLAB_PROOF`.
- **Observabilité** : `/api/health` (DB + Redis), Sentry (client+serveur,
  no-op si DSN absent), logs structurés pino avec redactions PII.
- **Rate-limit** Redis par route avec fallback mémoire.
- **i18n FR/EN** : cookie `bq_locale`, hook `useT()` avec interpolation
  `{var}`, parité des dictionnaires.
- **Tests** : 310 unitaires (Vitest) + 9 scénarios Playwright + audit a11y
  WCAG 2.1 AA (@axe-core/playwright).
- **Thème sombre** par défaut, polices Orbitron / Exo 2 / Geist Mono.

### Fonctionnalités prévues (roadmap)

- SMTP réel pour la vérification email.
- Locale WO (troisième langue).
- Migration i18n du reste des composants (quêtes, wallet, Académie).
- Élargissement `BITLAB_PROOF` au-delà de `tx-basics`
  (invoice-decode, channel-open).
- Récompenses Lightning Testnet sous feature flag.

Détail complet dans `docs/BITQUEST_ROADMAP.md` et `CHANGELOG.md`.

## Stack technique

### Frontend

- **Next.js 16** (App Router, Turbopack).
- **React 19** avec Server Components.
- **TypeScript** strict (vérifié par `npm run typecheck`).
- **Tailwind CSS 4** + sélection de primitives **shadcn/ui** basée sur Radix UI.
- **Lucide React** pour les icônes.
- **Framer Motion** pour les animations.
- **next-themes** pour le mode sombre.

### État client

- **Zustand** pour la session et la navigation SPA.
- **TanStack Query** pour le cache des appels API.

### Backend

- **Route Handlers Next.js** (`src/app/api/*`) pour l'API JSON interne.
- **Prisma 6** comme ORM, **PostgreSQL 16** comme base.
- **Redis 7** pour sessions, rate-limit et nonces anti-replay (fallback mémoire).
- **Zod** pour la validation à toutes les frontières API (unions discriminées).
- **crypto natif Node.js** (`scrypt`) pour le hachage des mots de passe.
- **jose** pour les JWT courts BitLab (HS256).
- **@sentry/nextjs** pour l'instrumentation (no-op sans DSN).
- **pino** pour les logs structurés avec redactions PII.
- **ioredis** pour le client Redis.

### Tests & qualité

- **Vitest** + **happy-dom** pour l'unitaire (310 tests / 17 fichiers).
- **Playwright** pour les scénarios E2E (auth, admin gate, défi du jour).
- **@axe-core/playwright** pour l'audit a11y WCAG 2.1 AA.
- **oxlint** + **ESLint** + **Prettier**.
- **GitHub Actions** (`.github/workflows/ci.yml`) avec services Postgres + Redis.

## Démarrage rapide

### Option A — Avec Docker (recommandé)

Un environnement de développement reproductible est fourni. Voir `docs/DOCKER_DEVELOPMENT.md` pour la documentation complète.

```bash
# Construire l'image
docker compose -f docker-compose.dev.yml build

# Installer les dépendances dans le volume nommé
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npm ci

# Générer le client Prisma
docker compose -f docker-compose.dev.yml run --rm bitquest-dev npx prisma generate

# Démarrer le serveur de dev
docker compose -f docker-compose.dev.yml up
```

Application disponible sur `http://localhost:3000`.

### Option B — Local (Node 20+)

#### Prérequis

- **Node.js 20** ou supérieur.
- **npm 10+** (ou npm 11 recommandé — cf. note sur `--package-lock-only`).

#### Installation

```bash
git clone https://github.com/GandalNexus/bitquest.git
cd bitquest

# Configurer l'environnement (Postgres + Redis requis)
cat > .env <<'EOF'
DATABASE_URL="postgresql://bitquest:bitquest@localhost:5432/bitquest"
REDIS_URL="redis://localhost:6379"
SESSION_COOKIE_SECRET="change-me-in-production"
CSRF_SECRET="change-me-in-production"
NODE_ENV="development"
EOF

# Installer et préparer
npm ci
npx prisma generate
npx prisma db push
npx prisma db seed

# Démarrer
npm run dev
```

Ouvre `http://localhost:3000`.

## Scripts npm

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement Next.js (port 3000) |
| `npm run build` | Build de production Next.js (⚠ voir issue connue en bas) |
| `npm start` | Serveur de production (nécessite Bun pour `.next/standalone/server.js`) |
| `npm run lint` | oxlint + ESLint |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm test` | Tests Vitest (une passe) |
| `npm run test:watch` | Tests Vitest en mode watch |
| `npm run format` | Prettier (écriture) |
| `npm run format:check` | Prettier (vérification seule) |
| `npm run db:generate` | Régénère le client Prisma |
| `npm run db:push` | Synchronise le schéma avec la base (⚠ dev uniquement, `--accept-data-loss`) |
| `npm run db:migrate` | Crée/applique une migration Prisma (dev) |
| `npm run db:reset` | Réinitialise la base (⚠ destructif) |

## Structure du projet

```
bitquest/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── api/                 # Route handlers (auth, me, quests, wallet, leaderboard)
│   │   ├── layout.tsx
│   │   ├── page.tsx             # SPA shell
│   │   └── global-error.tsx     # Boundary d'erreur racine
│   ├── components/
│   │   ├── bitquest/            # Composants métier (dashboard, quest-player, etc.)
│   │   └── ui/                  # Primitives shadcn/ui utilisées (12)
│   ├── hooks/                   # Hooks React partagés
│   ├── lib/
│   │   ├── bitquest/            # Domain layer (progression, missions, quests, …)
│   │   ├── db.ts                # Instance Prisma singleton
│   │   ├── seed-data.ts         # 11 quêtes + 15 badges + bots de leaderboard
│   │   └── utils.ts
│   └── test/
│       └── setup.ts             # Setup Vitest
├── prisma/
│   ├── schema.prisma            # 8 modèles (User, Quest, QuizQuestion, …)
│   └── seed.ts
├── docs/                        # Audit, architecture, roadmap, phases, release notes
├── public/                      # Assets statiques
├── e2e/                         # Scénarios Playwright + audit axe-core
├── Dockerfile.dev
├── docker-compose.dev.yml       # Postgres 16 + Redis 7 + app dev
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Documentation

Tous les documents de conception et d'audit sont dans `docs/` :

- `BITQUEST_AUDIT.md` — Audit du code existant.
- `BITQUEST_ARCHITECTURE.md` — Architecture cible.
- `BITQUEST_FEATURE_MATRIX.md` — Écart existant / cible.
- `BITQUEST_INTEGRATION_BITLAB.md` — Intégration BitLab prévue.
- `BITQUEST_ROADMAP.md` — Plan de développement par phases.
- `DOCKER_DEVELOPMENT.md` — Environnement Docker de dev.
- `PHASE_0_REPORT.md` — Rapport d'hygiène technique (Phase 0).
- `PHASE_3_BITLAB.md` — Fondation BitLab (TX + INVOICE + JWT challenge).
- `SECURITY_CHECKLIST.md` — Préparation Phase 5.5.
- `SPRINT_1B_SCHEMA_PLAN.md` — Plan de migration de schéma Sprint 1B.
- `LOT_1_DASHBOARD_ACADEMIE.md` — Audit Dashboard + plan Académie.
- `RELEASE_NOTES_v0.3.md` — Notes de la release 0.3.
- `CHANGELOG.md` (racine) — Journal versionné.

## Variables d'environnement

| Variable | Rôle | Obligatoire |
|---|---|---|
| `DATABASE_URL` | URL Postgres | Oui |
| `REDIS_URL` | URL Redis | Oui (fallback mémoire si absent) |
| `SESSION_COOKIE_SECRET` | HMAC du cookie de session | Oui |
| `CSRF_SECRET` | HMAC du token CSRF | Oui |
| `BITLAB_JWT_SECRET` | Secret JWT challenge BitLab | Non (fallback `CSRF_SECRET`) |
| `SENTRY_DSN` | Instrumentation Sentry | Non (no-op si absent) |

## Issues connues

- **Vulnérabilités npm** : quelques CVE de niveau moderate persistent sur des
  dépendances transitives (sharp, @mdxeditor/editor,
  react-syntax-highlighter). Toutes les corrections impliquent un breaking
  change. À traiter dans une fenêtre dédiée.

## Contribuer

Les contributions sont bienvenues ! Voir `CONTRIBUTING.md` et `CODE_OF_CONDUCT.md`.

Workflow :

1. Fork + branche de feature.
2. Vérifier localement : `npm run lint && npm run typecheck && npm test`.
3. Ouvrir une Pull Request contre `main`.

## Sécurité

Une vulnérabilité à signaler ? Merci de **ne pas** ouvrir d'issue publique. Suivre la procédure décrite dans `SECURITY.md`.

## Licence

[AGPL-3.0](LICENSE) © GandalNexus
