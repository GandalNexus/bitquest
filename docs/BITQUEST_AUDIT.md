# Audit BitQuest — 2026-11-09

> Rapport d'audit officiel, basé sur l'état réel du code au commit `95c1fdf` et sur la lecture intégrale du cahier des charges (`../cdc-bitquest.pdf`) et du manifeste (`../gandalnexus-manifesto.pdf`). Toutes les affirmations sont adossées à un chemin fichier:ligne.

---

## 1. Résumé exécutif

BitQuest est un projet Next.js 16 / React 19 / Prisma / SQLite **réellement fonctionnel** sur son chemin principal (inscription → parcours de quête → quiz → mission simulée → XP/sats/badges), mais **nettement en deçà du cahier des charges** sur plusieurs axes structurants :

- **ORM & base annoncés dans la documentation ≠ ORM & base effectifs.** Le `README.md` et le `CHANGELOG.md` promettent Drizzle + PostgreSQL ; le code utilise Prisma 6.11 + **SQLite** (`prisma/schema.prisma:5-8`, `src/lib/db.ts:1-13`), et le fichier de base est stocké en clair sous `db/custom.db`.
- **Aucune intégration réelle avec BitLab.** Les 8 missions "BitLab" sont **entièrement simulées côté serveur** (`src/lib/bitquest/missions.ts`, 568 lignes). Aucun appel HTTP, deep-link, postMessage, WebLN ou LDK. Le terme "BitLab" n'est présent qu'en texte d'interface.
- **Aucun satoshi réel n'est en jeu.** Les sats sont un entier `User.sats` incrémenté en base (`prisma/schema.prisma:19`) ; pas de wallet, pas de BOLT11, pas de rate-limiting côté chaîne. Cohérent avec la nature pédagogique mais à clarifier dans le discours produit.
- **Authentification "dev-only".** Sessions via `x-gn-user-id` + `x-gn-token` lus dans `localStorage` (pas de cookie `httpOnly`, pas de JWT, pas de CSRF). Hachage via `crypto.scryptSync` (acceptable) mais sans paramétrage adaptatif.
- **Zéro test exécutable.** `vitest.config.ts` pointe sur `app/actions/**`, `db/**`, `middleware.ts` — chemins qui n'existent pas dans ce projet, lequel est entièrement sous `src/`. Aucun `*.test.ts` dans le dépôt.
- **Zéro interface d'administration.** Pas de route `/admin`, pas de rôle, pas de CRUD pour les cours/quêtes/badges/quiz.
- **i18n non activée.** `next-intl@4.3.4` est présent dans `package.json:66` mais n'est importé nulle part — tout le contenu est en français en dur.
- **Dette "template".** Package nommé `nextjs_tailwind_shadcn_ts` (`package.json:2`), dépendance `z-ai-web-dev-sdk` jamais importée, 36 composants `shadcn/ui` orphelins, `next.config.ts:7` force `ignoreBuildErrors: true`.

Malgré cela, le cœur métier (progression, moteur de missions, moteur de badges, calcul XP/niveau/streak) est **soigné, isolé dans `src/lib/bitquest/`, testable, et de bonne qualité**. La refonte doit **préserver cette base** et non repartir de zéro.

---

## 2. Périmètre et méthode

- Lecture exhaustive : `README.md`, `CHANGELOG.md`, `AUTHORS.md`, `SECURITY.md`, `package.json`, `tsconfig.json`, `next.config.ts`, `middleware.ts`, `drizzle.config.ts`, `docker-compose.yml`, `.env.example`, `prisma/schema.prisma`, `vitest.config.ts`.
- Exploration systématique de `src/app/`, `src/components/`, `src/lib/`, `prisma/`, `db/`, `public/`.
- Vérification croisée via `grep -r "drizzle|next-auth|next-intl|webln|@scure|lightning"` (7 fichiers touchés, tous en référence textuelle, aucune intégration).
- Lecture intégrale de la route critique `src/app/api/quests/[code]/progress/route.ts` (303 lignes).
- Lecture intégrale des dépôts `../cdc-bitquest.pdf` (4 pages) et `../gandalnexus-manifesto.pdf` (2 pages).
- **Hors périmètre** : BitLab (`../bitlab/`), analysé séparément dans `BITQUEST_INTEGRATION_BITLAB.md`.

---

## 3. Stack réellement en place

| Couche | Annoncé (README/CdC) | Effectif |
|---|---|---|
| Framework | Next.js 14+ (App Router) | **Next.js 16.1.1** (`package.json:64`) |
| Langage | TypeScript strict | TS 5 strict (`tsconfig.json:7`), mais `noImplicitAny: false` (ligne 9) et `next.config.ts:7` : `ignoreBuildErrors: true` — **le typage n'est pas vraiment appliqué au build** |
| UI | Tailwind + shadcn/ui | ✅ Tailwind 4, 48 primitives shadcn (dont **36 non utilisées**) |
| State client | Zustand | ✅ Zustand 5 (`src/lib/bitquest/store.ts`) + TanStack Query 5 (`src/lib/bitquest/hooks.ts`) |
| ORM | Drizzle | ❌ **Prisma 6.11** (`src/lib/db.ts`, `prisma/schema.prisma`) |
| Base | PostgreSQL serverless | ❌ **SQLite** (`prisma/schema.prisma:6`). Fichier local : `db/custom.db` |
| Auth | NextAuth cité dans deps | ❌ Non utilisé. Auth maison `scrypt` + token localStorage |
| i18n | next-intl | ❌ Dépendance installée, zéro import |
| Tests | Vitest configuré | ⚠️ Config présente, **pointée sur des chemins inexistants**, zéro test |
| Déploiement | `output: "standalone"` + Caddyfile | ✅ Configuré (`next.config.ts:4`) |

**Dépendances "lourdes" présentes dans `package.json` mais sans usage avéré :**
- `next-auth@4.24.11` (ligne 65) — zéro import
- `next-intl@4.3.4` (ligne 66) — zéro import
- `@mdxeditor/editor@3.39.1` (ligne 24) — zéro import (éditeur jamais câblé)
- `@dnd-kit/*` (lignes 20-22) — zéro import
- `z-ai-web-dev-sdk@0.0.18` (ligne 83) — signature d'un template IA, **à retirer**
- `react-markdown`, `react-syntax-highlighter`, `embla-carousel-react`, `recharts`, `input-otp`, `react-resizable-panels`, `vaul` — à vérifier au cas par cas lors du nettoyage.

---

## 4. Modèle de données (Prisma / SQLite)

8 modèles, tous persistés en SQLite. Chaque champ JSON est stocké en `String` (contrainte SQLite, pas de type `Json` natif).

| Modèle | Rôle | Clé fonctionnelle | Remarques |
|---|---|---|---|
| `User` | Compte apprenant | `pseudo` unique, `token` unique | `isGuest` / `isBot` co-habitent ; aucun `role` admin |
| `Quest` | Définition d'une quête | `code` unique, `track`, `order` | `theorySections` et `missionConfig` sont du JSON stringifié |
| `QuizQuestion` | Question d'un quiz | `questId`, `order` | **Champ `quest2: String?` orphelin** (`prisma/schema.prisma:62`) — reliquat de migration mort |
| `UserQuestProgress` | État par utilisateur×quête | `@@unique([userId, questId])` | Stocke `missionSession` (challenge + attendu) et `missionProof` en JSON |
| `Badge` | Catalogue de badges | `code`, `rarity`, `conditionType`, `conditionValue` | 7 types de conditions, évaluation serveur |
| `UserBadge` | Attribution | `@@id([userId, badgeId])` | OK |
| `WalletTransaction` | Historique sats | `type` (QUEST_REWARD / STREAK_BONUS / DAILY_CAP) | Mono-directionnel : aucune dépense |
| `UserEvent` | Timeline utilisateur | `type` (5 valeurs), `payload` JSON | Alimente le dashboard |

**Problèmes identifiés :**
- **Pas de migrations versionnées.** Aucun dossier `prisma/migrations/`. Le script `db:push --accept-data-loss` est exécuté en dev ; en production ce flag est inacceptable.
- **`db/custom.db` est committable.** Le `.gitignore` ignore bien `*.db`, mais le fichier existe localement et peut fuir si quelqu'un force un commit.
- **Pas d'index de performance** au-delà des unicités. `UserQuestProgress.userId`, `WalletTransaction.userId`, `UserEvent.userId` seront lus très souvent — un index explicite accélérerait et préparerait la migration Postgres.
- **Types JSON stringifiés.** Acceptable pour SQLite ; à convertir en `Json` natif lors de la migration Postgres.

---

## 5. Authentification et sessions

**Fichier central** : `src/app/api/auth/route.ts` (113 lignes).

- Inscription (`action: "register"`) : validation `pseudo` 3–20 chars, email regex simple `^\S+@\S+\.\S+$`, mot de passe 6+ chars (**trop faible**). Hachage via `crypto.scryptSync` + salt 16 octets. Token = 32 octets aléatoires.
- Connexion (`action: "login"`) : vérification `crypto.timingSafeEqual` (bien).
- Invité (`action: "guest"`) : rate-limité en mémoire à 10/min/IP via `src/lib/bitquest/session.ts`.
- **Transport session** : client stocke `{ userId, token }` dans `localStorage` (clé `bitquest_session`), le `fetch` ajoute ensuite deux headers custom `x-gn-user-id` et `x-gn-token` (`src/lib/bitquest/client.ts`).
- **Middleware** (`middleware.ts:15`) : lit un cookie `user_session` qui **n'est jamais défini par le code** côté serveur. **La protection de route est donc inopérante** — n'importe qui peut taper `/dashboard` sans cookie et le middleware laissera passer... sauf qu'il redirige quand le cookie manque. **Contradiction** : la session est en `localStorage`, pas en cookie, donc l'utilisateur authentifié est quand même redirigé vers `/login`. À vérifier : il n'y a en pratique **qu'une seule page SPA** (`src/app/page.tsx`), donc l'incohérence est masquée mais **le middleware est à réécrire**.
- **Rôles** : aucun (`User` n'a pas de champ `role`).
- **CSRF** : non présent — acceptable tant que la session est hors cookie (donc non ciblable par CSRF classique), mais à revoir si l'on bascule vers un cookie `httpOnly`.
- **Rate limiting** : implémenté en mémoire (`src/lib/bitquest/session.ts:19`) — **réinitialisé à chaque redémarrage, inefficace en multi-instance**.

---

## 6. Module pédagogique (quêtes)

- **11 quêtes de seed** complètement rédigées en français (`src/lib/seed-data.ts`, 800+ lignes) : 3 INITIATION, 2 INTERMEDIATE, le reste réparti sur ADVANCED et SPECIAL.
- Structure d'une quête : `intro` + `theorySections` (JSON array de 3 sections `{title, body, keypoints}`) + 4 `QuizQuestion` + `missionType` + `missionConfig`.
- **Pas de contenu multimédia stocké** (images, vidéos, schémas). Le CdC exige des illustrations ; actuellement seul du texte.
- **Déverrouillage** : `src/lib/bitquest/quests.ts` applique une double règle (niveau requis + quête précédente complétée sur la même piste). Fonctionnel.
- **Progression persistée** : oui, via `UserQuestProgress` (statuts AVAILABLE / IN_PROGRESS / THEORY_DONE / QUIZ_PASSED / COMPLETED).
- **Prérequis pédagogiques transversaux** (ex. "complète la piste INITIATION avant toute quête SPECIAL") : non modélisés.
- **Éditeur de contenu** : absent. `@mdxeditor/editor` est installé mais non câblé. Le contenu se modifie uniquement en éditant le seed TypeScript.

---

## 7. Quiz et évaluations

- Types supportés : `MCQ` (choix unique parmi N) et `TRUE_FALSE`. **Pas de question à réponses multiples**, **pas de question ouverte**, **pas de validation conditionnelle "logique Bitcoin"** comme le mentionne le CdC §2.4.
- Correction : **100 % côté serveur** (`src/app/api/quests/[code]/progress/route.ts:109-125`). Le client reçoit le score et les explications par question.
- Seuil de passage : 70 % (`src/lib/bitquest/progression.ts` via `QUIZ_PASS_THRESHOLD`).
- Historique : `quizAttempts`, `quizBestScore`, `perfectQuiz` stockés dans `UserQuestProgress`.
- **Pas de banque de questions / randomisation** — les 4 questions sont fixes par quête.

---

## 8. Missions "BitLab" (en fait simulation serveur)

- **Fichier** : `src/lib/bitquest/missions.ts` (568 lignes), 2 fonctions principales : `generateMission(type, config)` et `validateMission(type, session, answer)`.
- **8 types** : `block_explorer`, `key_forge`, `tx_builder`, `mine_nonce`, `ln_channel`, `ln_invoice`, `multisig_sign`, `taproot_tweak`. Chaque type a son UI dédiée dans `src/components/bitquest/mission-panel.tsx`.
- **Modèle "challenge + expected"** : le serveur génère un challenge, stocke l'attendu dans `UserQuestProgress.missionSession` et compare la réponse du client. **La preuve est forgée côté serveur** et stockée dans `missionProof`.
- **Rien de tout cela ne touche une vraie blockchain, un vrai nœud Lightning, un vrai LDK.** Les BOLT11 affichés sont des strings synthétiques. C'est un simulateur pédagogique bien conçu, mais **à ne surtout pas présenter comme une intégration BitLab**.
- **Rate limiting mission** : 100 req/min par user via `rateLimit("progress:...")` + `MISSION_MAX_ATTEMPTS` par quête.

---

## 9. Gamification

**Moteur central** : `src/lib/bitquest/progression.ts` (239 lignes).

- **XP** : 4 sources (THEORY_SECTION = 5, QUIZ_PASS = 30, MISSION_SUCCESS = 50, QUEST_BONUS = 20).
- **Niveaux** : 10 paliers `[0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200]`. Titres fixes "Novice de la Genèse" → "Maître Satoshi".
- **Streak** : `User.streak` + `User.lastActiveDate`. Logique : +1 si activité hier, reset à 1 sinon.
- **Sats** : plafond journalier `SATS_DAILY_CAP = 10000`, bonus streak de 0 à 50 % (10 % par jour). `awardSats()` insère 1 ou 2 `WalletTransaction`.
- **Badges** : 15 en seed, évaluation automatique par `evaluateBadges(userId)` après chaque action impactante. 7 conditions : `QUEST_COMPLETE`, `QUEST_COUNT`, `TRACK_COMPLETE`, `STREAK`, `LEVEL`, `SATS_TOTAL`, `PERFECT_QUIZ`.
- **Classements** : route `GET /api/leaderboard` — top 20 par XP (`src/app/api/leaderboard/route.ts`).
- **Défis quotidiens/hebdomadaires** : **non implémentés** — le CdC les mentionne, le code ne les modélise pas.
- **Historique des récompenses** : oui (`WalletTransaction` + `UserEvent`).

---

## 10. Récompenses Bitcoin / Lightning

- **Lightning réel : zéro.** Aucune lib installée (pas de `@scure/*`, pas de `lightning`, pas de `webln`, pas de `ldk`).
- **WebLN : zéro.** Aucun `window.webln`.
- **Rate limiting côté chaîne : non applicable** (il n'y a pas de chaîne).
- **Protection contre les doubles récompenses** : oui au niveau applicatif — `progress.ts:236` vérifie `if (!p.missionProof)` avant d'attribuer l'XP mission, et `wasCompleted` empêche la double attribution du bonus de complétion et des sats.
- **Architecture sécurisée pour sats réels** : **à concevoir intégralement.** Aucune brique n'existe.

---

## 11. Administration

- **Aucune route `/admin`.**
- **Aucun rôle utilisateur.**
- **Aucun CRUD UI** pour quêtes, badges, cours, users, événements.
- **Aucune journalisation d'opérations admin.**
- La gestion du contenu se fait exclusivement en éditant `src/lib/seed-data.ts` puis en rejouant `prisma/seed.ts`. **Impossible pour un éditeur non-dev de contribuer.**

---

## 12. Interface utilisateur

**Architecture UI** : SPA monopage dans `src/app/page.tsx` (81 lignes) qui dispatche vers 5 vues via le store Zustand.

Composants métier dans `src/components/bitquest/` :
- `app-shell.tsx` (navbar + sidebar)
- `dashboard.tsx` (anneau niveau SVG, stats, 3 quêtes suggérées, timeline)
- `quest-map.tsx` (grille par piste)
- `quest-player.tsx` (lecteur 4 étapes théorie → quiz → mission → récap)
- `mission-panel.tsx` (8 UIs selon `missionType`)
- `leaderboard.tsx`, `wallet-view.tsx`, `profile-view.tsx`, `auth-screen.tsx`, `ui-bits.tsx`.

**Points forts** : dark mode via `next-themes`, polices soignées (Orbitron / Exo 2 / Geist Mono), Framer Motion utilisé pour transitions et célébrations.

**Points faibles** :
- Tout le routage se fait en client (`store.view`) → pas d'URL partageable, pas de SEO, pas de deep-link vers une quête.
- Pas de mode "mobile-first" documenté — `hooks/use-mobile.ts` est utilisé mais plusieurs écrans restent denses.
- Pas d'accessibilité vérifiée (pas de tests a11y, pas d'attributs ARIA systématiques).
- Pas d'écrans d'erreur / 404 / offline.

---

## 13. Internationalisation

- `next-intl@4.3.4` installé, **jamais importé**.
- Pas de dossier `messages/`, pas de configuration `next.config` dédiée.
- Tout le texte utilisateur est en français en dur.
- Le CdC prévoit FR + EN + Wolof. **À bâtir intégralement.**

---

## 14. Tests

- `vitest.config.ts` : coverage pointée sur `app/actions/**`, `db/**`, `middleware.ts` — **le projet n'a aucun dossier `app/actions`** (tout est sous `src/app/`), le dossier `db/` ne contient que `custom.db`, et le `middleware.ts` est à la racine. **Configuration obsolète, probablement copiée d'un template.**
- `__tests__/setup.ts` référencé comme `setupFiles` : **le dossier `__tests__` n'existe pas**.
- Aucun fichier `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx` dans le dépôt.
- Les commits récents (`3aadd0a test: add comprehensive stress test suite for auth and quests`) suggèrent qu'une suite de tests a existé puis a été **supprimée par le commit `a2d7ad9 refactor: add new codebase`**. À confirmer par `git log --diff-filter=D`.

---

## 15. Sécurité

| Thème | État | Verdict |
|---|---|---|
| Hachage mdp | `scryptSync` + salt 16o | ✅ Correct |
| Comparaison | `timingSafeEqual` | ✅ Correct |
| Transport session | `localStorage` + headers custom | ⚠️ Pas de `httpOnly`, vulnérable au XSS |
| CSRF | Absent | ⚠️ Non requis tant que pas de cookie, à prévoir sinon |
| Validation d'entrée | Manuelle, pas de Zod | ⚠️ Zod installé mais non utilisé |
| Rate limiting | En RAM | ⚠️ Non viable en production |
| Secrets | `.env.example` sans secret | ✅ Pas de leak |
| Permissions API | Authentification seule, pas d'autorisation granulaire | ⚠️ Pas de rôle |
| Injection SQL | Prisma paramétré | ✅ Sûr |
| Protection XSS | React (échappement auto) | ✅ Par défaut |
| `JSON.parse` sur champs stockés | Non sanitizé | ⚠️ Risque faible (données contrôlées par seed) |
| Secrets Bitcoin côté serveur | Aucune clé | ✅ Conforme au CdC §4 |

---

## 16. Déploiement et DevOps

- `next.config.ts` : `output: "standalone"` ✅ + `ignoreBuildErrors: true` ❌.
- `Caddyfile` présent (reverse proxy) — à auditer séparément.
- `docker-compose.yml` déclare Postgres 16 — **incohérent** avec le `prisma/schema.prisma` qui utilise SQLite.
- `.github/` existe — workflows à inventorier.
- `oxlint` + `eslint` + `prettier` + `prettier-plugin` configurés. Qualité statique OK.
- Pas de CI visible qui lint/type-check/test.

---

## 17. Ce qui est **réellement** fonctionnel, à préserver

1. **Moteur de progression** (`src/lib/bitquest/progression.ts`) — XP, niveau, streak, sats, badges.
2. **Moteur de missions simulées** (`src/lib/bitquest/missions.ts`) — 8 types, génération & validation côté serveur.
3. **Route progression** (`src/app/api/quests/[code]/progress/route.ts`) — gestion complète des 5 actions, idempotence sur les récompenses.
4. **Seed pédagogique** (`src/lib/seed-data.ts`) — 11 quêtes bien écrites en français.
5. **Dashboard + anneau niveau** — UX travaillée.
6. **Zustand + TanStack Query** — stack client saine.
7. **Dark mode + polices** — identité visuelle cohérente.

## 18. Ce qui est **absent** ou **défectueux**, par ordre d'urgence

### Critique (bloque la cible "plateforme de référence")
- Admin complet (CRUD quêtes, cours, chapitres, quiz, badges, users, événements).
- Rôles utilisateurs (admin / éditeur / apprenant).
- Modèle Course / Chapter / Lesson (le CdC implique une structure hiérarchique au-dessus de la Quête, actuellement absente).
- Intégration BitLab réelle (voir `BITQUEST_INTEGRATION_BITLAB.md`).
- Tests (unitaires au moins sur `progression.ts` et `missions.ts`, E2E sur le parcours de quête).
- i18n FR/EN (puis WO).

### Fort
- Migration vers PostgreSQL et migrations Prisma versionnées.
- Session cookie `httpOnly` + CSRF.
- Rate limiting persistant (Redis / DB).
- Éditeur de contenu (MDX déjà installé).
- Illustrations / contenu multimédia dans les quêtes.
- Défis quotidiens / hebdomadaires.
- Pages dédiées par vue (URL partageables, SEO, deep-link).

### Moyen
- Nettoyage des dépendances inutilisées (`next-auth`, `@mdxeditor` si abandonné, `@dnd-kit`, `z-ai-web-dev-sdk`, composants shadcn orphelins).
- Correction de `middleware.ts` (ou suppression si on reste SPA).
- `next.config.ts` : désactiver `ignoreBuildErrors`.
- Index Prisma manquants.
- Renommage `package.json` (actuellement `nextjs_tailwind_shadcn_ts`) → `bitquest`.
- Nettoyage du champ orphelin `QuizQuestion.quest2`.

### Faible
- Suppression de `db/custom.db` du tracking (ou vérification `.gitignore`).
- Documenter le `Caddyfile`.
- Ajout d'une page `/about`, `/privacy`, `/terms`.

---

## 19. Risques majeurs identifiés

1. **Discours produit vs réalité technique.** Le README promet une pile (Drizzle / Postgres) qui n'est pas celle du code ; le CdC promet une intégration BitLab qui n'existe pas. Risque de perte de confiance si un contributeur externe audite le projet.
2. **Suppression silencieuse des tests.** Le commit `a2d7ad9 refactor: add new codebase` paraît avoir remplacé la codebase d'un coup — potentiellement destructif. À auditer (`git show --stat a2d7ad9`).
3. **Dépendance `z-ai-web-dev-sdk`.** Signature d'un code généré par un service tiers ; vérifier les fichiers associés et retirer.
4. **`ignoreBuildErrors: true`.** Masque toutes les erreurs TS au build. Un refactor en production peut casser silencieusement.
5. **Gestion contenu par seed.** Impossible de collaborer avec un rédacteur non-dev tant qu'il n'y a pas d'admin.

---

## 20. Conclusion de l'audit

BitQuest n'est **ni un simple quiz**, **ni la plateforme décrite dans le cahier des charges** — c'est un **MVP pédagogique sérieux avec un moteur métier solide**, mais dont la couche "produit" (admin, contenu dynamique, i18n, tests, BitLab) et la couche "ops" (Postgres, migrations, sécurité session) ne sont pas encore construites.

La bonne nouvelle : le **cœur métier (`src/lib/bitquest/`) et le seed sont de qualité suffisante pour être conservés** et servir de fondation à la refonte. La mauvaise : il reste **au moins 60 à 80 jours-homme** de travail pour atteindre les objectifs du CdC (voir `BITQUEST_ROADMAP.md`).

---

**Rédigé le** : 2026-11-09
**Prochain livrable** : `BITQUEST_ARCHITECTURE.md`
