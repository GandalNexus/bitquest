# Rapport Phase 0 — Hygiène technique BitQuest

**Date** : 2026-11-09
**Branche** : `phase-0-docker-setup`
**Environnement d'exécution** : conteneur Docker `bitquest-dev` (Node 20 bookworm-slim)
**Base SQLite** : `db/custom.db` — **INTACTE** (SHA-256 `4e3ac78e…` identique du début à la fin)

---

## 1. Synthèse

La Phase 0 d'hygiène technique est **terminée** avec les résultats suivants :

| Indicateur | Avant | Après |
|---|---|---|
| Nom du package | `nextjs_tailwind_shadcn_ts` | `bitquest` |
| Erreurs `tsc --noEmit` | masquées par `ignoreBuildErrors: true` | **0** (vérifiées) |
| Warnings/erreurs `lint` | 1 erreur pré-existante (carousel.tsx) | **0** |
| Tests unitaires | **0** | **25 passants** (Vitest sur `progression.ts`) |
| Composants shadcn/ui | 48 (36 orphelins) | **12** (tous utilisés) |
| Dépendances orphelines | `z-ai-web-dev-sdk`, config `drizzle` | retirées |
| Workflow CI | Node 18, pas de test, DATABASE_URL incohérent | Node 20, 4 jobs (lint / typecheck / test / build) |
| README | Annonce Drizzle + PostgreSQL (faux) | Reflète Prisma + SQLite, avertissement sats pédagogiques |
| Environnement de dev | installation sur le host | Docker reproductible (`docker-compose.dev.yml`) |

---

## 2. Modifications réalisées

### 2.1 Identité du projet

- `package.json` :
  - `name` : `nextjs_tailwind_shadcn_ts` → **`bitquest`**
  - Ajout de `description`, `license: AGPL-3.0`, `author: GandalNexus`
  - Retrait de la dépendance `z-ai-web-dev-sdk@^0.0.18` (0 import dans `src/`, confirmé)
  - Ajout des scripts `typecheck`, `test`, `test:watch`
  - Ajout des devDependencies `vitest@^3.2.0` et `happy-dom@^19.0.0`

### 2.2 TypeScript

- `next.config.ts` : suppression de `typescript: { ignoreBuildErrors: true }` et du commentaire placeholder.
- Script `typecheck: "tsc --noEmit"` ajouté.
- 11 erreurs TypeScript initiales → **0** après :
  - Suppression de `drizzle.config.ts` (fichier mort référençant `drizzle-kit` non installé).
  - Régénération du client Prisma (`npx prisma generate`) qui restaure l'export `PrismaClient`.
  - Installation de `vitest` qui fournit `vitest/config`.
- Aucune utilisation de `any` injustifié, aucun `@ts-ignore` ajouté.

### 2.3 Vitest

- `vitest.config.ts` corrigé :
  - `setupFiles` : `__tests__/setup.ts` (inexistant) → `src/test/setup.ts`
  - `include` : nouveau glob `src/**/*.{test,spec}.{ts,tsx}`
  - `coverage.include` : pointait sur `app/actions/**`, `db/**`, `middleware.ts` (chemins inexistants) → maintenant `src/lib/bitquest/**`, `src/app/api/**`, `middleware.ts`
  - `alias "@"` : `path.resolve(__dirname, ".")` → `path.resolve(__dirname, "./src")` (cohérent avec `tsconfig.json`)
- `src/test/setup.ts` créé (minimal, extensible en Phase 1).
- `src/lib/bitquest/progression.test.ts` créé : **25 tests** couvrant les fonctions pures du moteur de progression.
  - `LEVEL_THRESHOLDS`, `LEVEL_TITLES`, `XP_RULES`, `QUIZ_PASS_THRESHOLD`, `SATS_DAILY_CAP`, `MISSION_MAX_ATTEMPTS` (verrous sur les constantes métier)
  - `levelFromXp` : 7 cas (XP 0, 99, 100, 10 seuils, intermédiaires, plafond)
  - `levelInfo` : 6 cas (progression 0 %, mi-niveau, inter-niveau, niveau max avec `next=null`, bornes)
  - `updateStreak` : 5 cas (même jour, hier, saut, nouvel utilisateur, initial à 0)
  - `publicUser` : 5 cas (champs publics, levelInfo, pas de leak de passwordHash/token, createdAt, invité)
- `.gitignore` corrigé : la règle trop large `test` ignorait `src/test/` ; devenue `/test` (racine seulement). Même traitement pour `prompt` → `/prompt`.

### 2.4 Schéma Prisma

- `prisma/schema.prisma` : suppression du champ orphelin `QuizQuestion.quest2 String?` (0 référence dans le code).
- Client Prisma régénéré via `npx prisma generate` dans le conteneur.
- **La base `db/custom.db` n'a PAS été modifiée** : SQLite tolère la colonne résiduelle de manière inerte. Aucun `db push`, aucun `migrate`, aucun `reset`.

### 2.5 CI GitHub Actions

Workflow `.github/workflows/ci.yml` refait en gardant le même esprit :

- Node 18 → **Node 20**.
- Variable globale `DATABASE_URL=file:./db/custom.db` (cohérente avec le schéma SQLite — avant : `postgresql://test:test@...` trompeur).
- `NEXT_TELEMETRY_DISABLED=1`.
- 4 jobs :
  - `lint` (oxlint + eslint) — bloquant.
  - `typecheck` (`npm run typecheck`) — bloquant.
  - `test` (`npm test`) — bloquant, dépend de lint + typecheck.
  - `build` (`npm run build`) — **non bloquant** (`continue-on-error: true`), à cause d'une issue pré-existante (voir §4).
- Chaque job inclut désormais `npx prisma generate` avant les étapes.

### 2.6 Nettoyage composants shadcn/ui

Après analyse exhaustive des imports (statiques + transitifs) dans `src/`, 36 composants à **0 référence externe** supprimés :

```
accordion alert-dialog aspect-ratio avatar breadcrumb calendar carousel
chart collapsible command context-menu dialog drawer dropdown-menu form
hover-card input-otp menubar navigation-menu pagination popover resizable
scroll-area select separator sheet sidebar skeleton slider sonner switch
table textarea toggle toggle-group tooltip
```

**12 composants conservés** (effectivement utilisés par le code métier) :
`alert, badge, button, card, checkbox, input, label, progress, radio-group, tabs, toast, toaster`.

Les dépendances npm associées (`@radix-ui/*` non utilisés, `cmdk`, `embla-carousel-react`, `react-day-picker`, `react-resizable-panels`, `vaul`, `input-otp`, `sonner`, etc.) **n'ont pas été retirées** du `package.json` à ce stade (approche conservatrice). À traiter en Phase 1 avec `depcheck`.

### 2.7 Boundary d'erreur racine

`src/app/global-error.tsx` créé — Client Component minimal (aucun hook de contexte, aucun provider). Tentative de correctif pour l'issue de build pré-existante (voir §4). Le fichier reste utile même si le fix principal viendra en Phase 1.

### 2.8 README

Entièrement réécrit pour refléter :
- Stack réelle : **Prisma + SQLite** (plus de Drizzle + Postgres).
- Scripts réels (retrait de `db:start`/`db:stop` qui n'existent pas).
- **Avertissement explicite** sur le positionnement pédagogique des sats (aucun transfert on-chain ni paiement Lightning réel à ce stade).
- Option d'installation Docker documentée.
- Section "Issues connues" (build prerender + 17 vulnérabilités npm).
- Section Documentation listant les 7 fichiers `docs/`.

### 2.9 Docker (préalable)

Les 4 fichiers Docker (déjà commités en `34b994b`) ont permis d'exécuter toutes les vérifications de Phase 0 dans un environnement reproductible, sans toucher au Node du Mac host :

- `Dockerfile.dev`, `docker-compose.dev.yml`, `.dockerignore`, `docs/DOCKER_DEVELOPMENT.md`.
- Toutes les commandes `npm`, `npx prisma`, `npx tsc`, `npx vitest` de ce rapport ont tourné dans le conteneur `bitquest-dev`.

---

## 3. Fichiers modifiés et supprimés

### Modifiés
```
.github/workflows/ci.yml     — CI Node 20, 4 jobs
.gitignore                    — règles test/prompt resserrées
README.md                     — stack réelle, avertissement sats, Docker
next.config.ts                — retrait ignoreBuildErrors
package-lock.json             — régénéré (vitest+happy-dom, -z-ai)
package.json                  — rename, scripts, deps
prisma/schema.prisma          — suppression champ quest2
vitest.config.ts              — chemins corrigés
```

### Supprimés (37 fichiers)
```
drizzle.config.ts                            (fichier mort)
src/components/ui/*.tsx                      (36 composants orphelins)
```

### Créés
```
src/app/global-error.tsx                     (boundary minimal)
src/lib/bitquest/progression.test.ts         (25 tests unitaires)
src/test/setup.ts                            (setup Vitest)
docs/PHASE_0_REPORT.md                       (ce fichier)
```

---

## 4. Problèmes non résolus

### 4.1 Build Next.js — issue pré-existante

```
Error occurred prerendering page "/_global-error".
TypeError: Cannot read properties of null (reading 'useContext')
```

- **Pré-existant** : vérifié par `git stash` + `next build` sur l'état précédent le commit `34b994b`. L'erreur est antérieure à la Phase 0.
- **Non résolu par** : ajout de `src/app/global-error.tsx` minimal.
- **Cause probable** : interaction Next 16 + Turbopack + React 19 lors du prerender statique de la route système `/_global-error`. Les warnings `Each child in a list should have a unique "key" prop` sur `<html>`, `<body>`, `<head>`, `<meta>` suggèrent un problème dans la gestion des metadata React 19 / Next.
- **Impact immédiat** : nul en développement (`npm run dev` fonctionne). Impact sur la mise en production.
- **Décision Phase 0** : CI laisse le job `build` en `continue-on-error: true` avec un commentaire explicite. À traiter en Phase 1.

### 4.2 Vulnérabilités npm — non corrigées

17 vulnérabilités (12 moderate, 5 high, 0 critical) détectées par `npm audit`. Toutes les corrections demandent un breaking change :

| Package | Chaîne | Sévérité | Fix nécessite |
|---|---|---|---|
| `js-yaml` | via `@mdxeditor/editor` | high | `@mdxeditor/editor@4.5.0` |
| `sharp` | direct | high | `sharp@0.35.5` |
| `minimatch` | via `eslint-config-next` | moderate | `eslint-config-next@15.5.29` |
| `prismjs` | via `react-syntax-highlighter` | moderate | `react-syntax-highlighter@16.1.2` |

Aucune correction automatique (`npm audit fix --force`) n'a été lancée. À traiter en Phase 1 après évaluation des breaking changes.

### 4.3 Base de données : colonne `quest2` résiduelle

Le champ a été retiré du schéma Prisma mais la colonne reste dans `db/custom.db` (SQLite). Cette colonne est inerte et ignorée par le client Prisma. Elle disparaîtra lors de la migration PostgreSQL (planifiée en phase future). **Décision assumée** : pas de `prisma db push` en Phase 0 pour respecter la consigne "Ne jamais toucher la base".

### 4.4 Lockfile `bun.lock` non synchronisé

`bun.lock` conserve `z-ai-web-dev-sdk` et l'état pré-nettoyage. Préservé intact par consigne. À réconcilier la première fois qu'un contributeur utilisera `bun install` (hors Phase 0).

---

## 5. Risques identifiés

| # | Risque | Mitigation en place | À faire |
|---|---|---|---|
| R1 | Build de production cassé | CI non bloquant, doc README | Phase 1 : debug Next 16 / global-error |
| R2 | Vulnérabilités `high` sur dépendances actives (`sharp`) | Document audit, pas d'exécution auto | Phase 1 : upgrade + revue breaking |
| R3 | Base `custom.db` contient une colonne `quest2` fantôme | Prisma l'ignore ; aucune lecture code | Supprimée lors de la migration Postgres |
| R4 | npm 10.8.2 par défaut dans l'image a un bug `--package-lock-only` | Doc + usage `npx npm@11` pour régénérer | Phase 1 : pinner npm 11 dans Dockerfile.dev |
| R5 | `bun.lock` divergent de `package.json` | Doc dans ce rapport | Reconciler lors du passage à Bun si décidé |
| R6 | `node_modules` Linux dans le volume Docker n'est pas compatible host Mac | Documenté dans `DOCKER_DEVELOPMENT.md` | Rien, c'est le design voulu |

---

## 6. Résultats des vérifications finales

Toutes les commandes exécutées dans le conteneur `bitquest-dev`.

### 6.1 TypeScript
```
$ npm run typecheck
> tsc --noEmit
(aucune sortie → 0 erreur)
```

### 6.2 Lint
```
$ npm run lint
> oxlint --config oxlint.json src/ && eslint .
Found 0 warnings and 0 errors.
Finished in 170ms on 47 files with 140 rules using 4 threads.
```

### 6.3 Tests
```
$ npm test
> vitest run

 ✓ src/lib/bitquest/progression.test.ts (25 tests) 15ms

 Test Files  1 passed (1)
      Tests  25 passed (25)
   Duration  1.23s
```

### 6.4 Build (non bloquant, échec documenté)
```
$ npm run build
...
Error occurred prerendering page "/_global-error".
TypeError: Cannot read properties of null (reading 'useContext')
⨯ Next.js build worker exited with code: 1
```

### 6.5 Intégrité de la base
```
$ shasum -a 256 db/custom.db
4e3ac78eb92eb055ba2a2704458100d20525856de93b86f98f275be5b6c34607  db/custom.db
```
Identique au SHA-256 initial du début de la Phase 0.

---

## 7. Recommandations pour la suite

### 7.1 Phase 1 — à démarrer

Par ordre de priorité :

1. **Résoudre le build** (`/_global-error` prerender). Options à explorer :
   - Désactiver Turbopack pour le build (`next build --no-turbo` si disponible) et comparer.
   - Mettre à jour Next.js vers la dernière minor (ou downgrade à 16.3 si régression).
   - Isoler les providers de layout.tsx si nécessaire.
2. **Durcir la session** : cookie `httpOnly; Secure; SameSite=Lax` + CSRF (priorité sécurité).
3. **Validation Zod partout** côté serveur (schémas par route).
4. **Rate limiting persistant** (Redis).
5. **Rôles utilisateur** : enum `Role { APPRENTICE, EDITOR, ADMIN }` + helper `requireRole`.
6. **Tests supplémentaires** sur `missions.ts` (8 types), routes API clés (`/api/quests/[code]/progress`).
7. **Correctifs vulnérabilités npm** : évaluer breaking changes de `sharp@0.35.5` et `@mdxeditor/editor@4.5.0` (ce dernier n'étant pas encore utilisé par le code).

### 7.2 Nettoyage de deps (différé — à faire en Phase 1)

Un passage `depcheck` aidera à retirer les deps devenues inutiles après la suppression des 36 composants shadcn :

Candidats probables (à confirmer) : `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `vaul`, `sonner` (bibliothèque différente du composant `sonner.tsx` supprimé), et plusieurs `@radix-ui/*` dont les composants consommateurs ont été retirés.

### 7.3 Amélioration du Dockerfile.dev

- Pinner `npm@11` (au lieu de `npx -y npm@11` ponctuel) pour éviter le bug `--package-lock-only` de npm 10.
- Réduire la taille d'image en déplaçant `openssl`, `ca-certificates`, `curl` dans une étape multi-stage si nécessaire en Phase 2.

### 7.4 Documentation développeur

- Compléter `CONTRIBUTING.md` avec le workflow Docker.
- Ajouter une section "ADR" (Architecture Decision Records) dans `docs/` pour tracer les choix structurels (Prisma conservé, SQLite transitoire, option B pour BitLab, etc.).

---

## 8. Prochaine étape

Passer au **Lot 1 de développement** (Dashboard + Académie), documenté dans `docs/BITQUEST_FEATURE_MATRIX.md` et `docs/BITQUEST_ROADMAP.md`. Une note d'audit et plan d'attaque sera produite dans `docs/` avant toute modification de code métier (`src/components/bitquest/dashboard.tsx` et la future zone `src/app/(app)/academy/*`).

---

**Rédigé le** : 2026-11-09
**Auteur** : Claude Opus 4.7 (assisté) pour GandalNexus / BitQuest
