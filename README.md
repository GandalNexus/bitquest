# BitQuest

![Bitcoin](https://img.shields.io/badge/Bitcoin-FF9900?style=flat-square&logo=bitcoin&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js%2016-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
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

### Fonctionnalités actuelles

- **Authentification** (compte email/password + mode invité).
- **Dashboard** avec anneau de niveau, statistiques et timeline d'événements.
- **11 quêtes seedées** en français, réparties sur 4 pistes (initiation, intermédiaire, avancée, spéciale).
- **Moteur de progression** : 10 niveaux (0 à 3200 XP), streaks quotidiens, bonus de série sur les sats (0–50 %), plafond journalier de 10 000 sats.
- **15 badges** avec 7 types de conditions (complétion de quête, séries, niveaux, totaux, quiz parfaits, etc.).
- **Classement** des 20 meilleurs apprenants par XP.
- **Portefeuille** pédagogique avec historique des transactions.
- **Thème sombre** par défaut, polices soignées (Orbitron, Exo 2, Geist Mono).

### Fonctionnalités prévues (roadmap)

- Académie structurée (cours → chapitres → leçons MDX avec illustrations).
- Interface d'administration (CRUD cours, quêtes, badges, utilisateurs).
- Internationalisation FR / EN / WO.
- Intégration BitLab réelle avec vérification de preuves on-chain / Lightning via `mempool.space`.
- Récompenses Lightning Testnet sous feature flag.
- Migration vers PostgreSQL pour la production.

Détail complet dans `docs/BITQUEST_ROADMAP.md`.

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
- **Prisma 6** comme ORM.
- **SQLite** comme base de données (fichier `db/custom.db` en dev). Migration PostgreSQL planifiée.
- **crypto natif Node.js** (`scrypt`) pour le hachage des mots de passe.

### Tests & qualité

- **Vitest** + **happy-dom** pour les tests unitaires (voir `src/lib/bitquest/progression.test.ts`).
- **oxlint** + **ESLint** + **Prettier**.
- **GitHub Actions** (`.github/workflows/ci.yml`).

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

# Configurer l'environnement
echo 'DATABASE_URL="file:./db/custom.db"' > .env
echo 'NODE_ENV="development"' >> .env

# Installer et préparer
npm ci
npx prisma generate

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
├── db/
│   └── custom.db                # Base SQLite (versionnée avec le seed initial)
├── docs/                        # Audit, architecture, roadmap, intégration BitLab, Docker
├── public/                      # Assets statiques
├── Dockerfile.dev
├── docker-compose.dev.yml
├── docker-compose.yml           # (PostgreSQL, actuellement non utilisé — phase future)
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

## Issues connues

- **Build Next.js** : la commande `npm run build` échoue actuellement au stade de prerender de la route interne `/_global-error` (`TypeError: Cannot read properties of null (reading 'useContext')`). Cette erreur est **pré-existante** (antérieure au commit `a2d7ad9`) et sera corrigée en Phase 1. La CI exécute le build mais ne bloque pas le pipeline tant que le fix n'a pas été identifié. Le serveur de dev (`npm run dev`) fonctionne sans problème.
- **17 vulnérabilités npm** (12 moderate, 5 high, 0 critical) détectées via `npm audit`. Toutes les corrections impliquent des breaking changes (sharp, @mdxeditor/editor, eslint-config-next, react-syntax-highlighter). À traiter en Phase 1.

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
