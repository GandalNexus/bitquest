# Architecture cible BitQuest — 2026-11-09

> Proposition d'architecture fonctionnelle et technique **cible**, dérivée du cahier des charges (`../cdc-bitquest.pdf`) et du manifeste (`../gandalnexus-manifesto.pdf`), alignée avec l'existant audité dans `BITQUEST_AUDIT.md`. L'objectif est de **conserver le cœur métier déjà écrit** et de **construire autour** les briques manquantes.

---

## 1. Principes directeurs

1. **Conserver Prisma, migrer vers PostgreSQL.** Prisma est déjà intégré, le CdC veut Postgres. On garde l'ORM en place, on change la source de données.
2. **Préserver `src/lib/bitquest/` comme domain layer.** Ces 7 modules (`client`, `hooks`, `missions`, `progression`, `quests`, `session`, `store`) sont le noyau fonctionnel du produit. Ils doivent rester le point d'entrée canonique.
3. **Monter en charge progressivement sur la sécurité.** On part d'une base `localStorage` + token, on migre vers cookie `httpOnly` + CSRF une fois la surface utilisateur stabilisée. Ne pas tout refaire d'un coup.
4. **BitLab reste maître de la cryptographie Bitcoin.** BitQuest ne manipule pas de clés privées, ne signe pas de transaction. Les missions pratiques s'exécutent **dans BitLab**, BitQuest vérifie une preuve publique (txid, BOLT11).
5. **Clean Architecture modérée.** Trois couches claires (`domain`, `infrastructure`, `presentation`), sans multiplier les abstractions. Pas de "clean" dogmatique.
6. **Server Actions + Route Handlers.** Server Actions pour les mutations déclenchées depuis des composants ; Route Handlers pour les endpoints appelés en fetch (SPA actuelle) ou par BitLab (preuves).
7. **Validation Zod systématique à toute frontière.** Zod est déjà installé.
8. **Pas de récompense Lightning réelle en phase 1.** La boucle "earn" sera activée après audit sécurité dédié, derrière un feature flag.

---

## 2. Vue d'ensemble des couches

```
┌───────────────────────────────────────────────────────────────┐
│  PRESENTATION  (src/app, src/components)                      │
│  - Pages App Router (/, /academy, /quests, /admin, /profile)  │
│  - Composants UI (shadcn/ui, dashboard, quest-player)         │
│  - Hooks client (useMe, useQuests via TanStack Query)         │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  APPLICATION  (src/app/api, src/app/actions, src/lib/auth)    │
│  - Route Handlers (REST)                                      │
│  - Server Actions (mutations)                                 │
│  - Auth middleware (next-auth v5 ou maison durcie)            │
│  - Validation Zod, rate limiting, autorisation par rôle       │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  DOMAIN  (src/lib/bitquest)                                   │
│  - Progression engine (XP, levels, streak, sats, badges)      │
│  - Mission engine (generate / validate 8 types)               │
│  - Quest state machine                                        │
│  - Reward engine (daily cap, streak bonus, idempotence)       │
│  - BitLab proof verifier (txid → mempool.space)               │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE  (src/lib/db, src/lib/cache, src/lib/intl)    │
│  - Prisma client (Postgres)                                   │
│  - Cache Redis (rate limit, idempotency keys)                 │
│  - i18n next-intl                                             │
│  - Mempool.space client (vérification preuves BitLab)         │
│  - Bridge BitLab (postMessage / JWT)                          │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. Modèle de données cible

### 3.1 Évolution incrémentale du schéma Prisma

On garde les 8 modèles actuels et on ajoute une couche pédagogique au-dessus de `Quest`, ainsi que les briques nécessaires pour l'admin, l'i18n, les défis périodiques et le bridge BitLab.

**Nouveaux modèles :**

| Modèle | Rôle | Relations clés |
|---|---|---|
| `Course` | Parcours pédagogique (ex. "Fondamentaux Bitcoin") | `chapters[]` |
| `Chapter` | Chapitre d'un cours (ex. "La propriété numérique") | `course`, `lessons[]`, `quests[]` |
| `Lesson` | Leçon atomique MDX avec objectifs, prérequis | `chapter`, `assets[]` |
| `LessonAsset` | Image / schéma / vidéo liée à une leçon | `lesson`, `type`, `url` |
| `LessonProgress` | État par user × lesson | `user`, `lesson`, `completedAt` |
| `Role` (enum) | `APPRENTICE`, `EDITOR`, `ADMIN` | ajouté à `User.role` |
| `AdminAuditLog` | Journalisation des opérations admin | `actor`, `entity`, `action`, `before`, `after` |
| `DailyChallenge` | Défi quotidien | `date`, `questCode`, `xpBonus` |
| `WeeklyChallenge` | Défi hebdomadaire | `weekStart`, `requirement`, `reward` |
| `RewardIdempotencyKey` | Clé d'idempotence récompense | `key` unique, `grantedAt` |
| `BitLabProof` | Preuve d'action BitLab | `user`, `questId`, `kind` (TXID / BOLT11 / NODE_ID), `value`, `verifiedAt`, `network` |
| `LocaleString` | Traduction (si on externalise les contenus) | `key`, `locale`, `value` |

**Ajouts aux modèles existants :**

- `User` : `role Role @default(APPRENTICE)`, `preferredLocale String @default("fr")`, `nostrPubkey String? @unique`, `deletedAt DateTime?`.
- `Quest` : `chapterId String?` (optionnel pour les SPECIAL hors cursus), `estimatedMinutes Int`, `publishedAt DateTime?`, `theorySectionsRich Json` (une fois en Postgres, type `Json` natif).
- `QuizQuestion` : suppression du champ orphelin `quest2`. Ajout de `type` enum étendu : `MCQ | MULTI | TRUE_FALSE | LOGIC`.

### 3.2 Index à ajouter

- `UserQuestProgress(userId)`, `UserQuestProgress(status)`.
- `WalletTransaction(userId, createdAt)`.
- `UserEvent(userId, createdAt)`.
- `Quest(track, order)`.
- `BitLabProof(user, questId)`.

### 3.3 Migration SQLite → PostgreSQL

Trois étapes :
1. **Geler SQLite.** Snapshot du `db/custom.db` courant (pour un rollback possible).
2. **Générer une migration initiale Postgres** à partir du schéma actuel : `prisma migrate dev --name init`. Résout aussi le problème "pas de migrations versionnées".
3. **Convertir les champs JSON stringifiés en `Json` natif** dans une seconde migration.

`docker-compose.yml` est déjà configuré pour Postgres 16 — on l'utilise tel quel en dev.

---

## 4. Authentification et sessions

### Phase 1 (court terme — préserver l'existant, durcir)

- Conserver `scrypt` + token aléatoire côté serveur.
- **Remplacer `localStorage` par un cookie `httpOnly; Secure; SameSite=Lax`.** Le middleware `middleware.ts` devient alors opérant. La route API lit le cookie et non plus les headers custom.
- Ajouter un **token CSRF** dans un cookie lisible, vérifié sur les mutations.
- Valider toute entrée via Zod (schema dédié par route).
- Introduire un champ `User.role` et un helper `requireRole("ADMIN")` utilisé par toutes les routes sensibles.
- Rate limiting persistant via Redis (Upstash en prod, image locale en dev).

### Phase 2 (moyen terme — si on vise OAuth / Nostr)

- Introduire **NextAuth v5** (ou Auth.js) : déjà en dépendance dans `package.json` (next-auth v4 à mettre à jour). Providers : credentials (actuel), Nostr NIP-07, email magic link.
- **Mode invité** conservé — session anonyme, données purgeables.
- **Deux sessions superposées** possible : apprenant anonyme qui "upgrade" ensuite en compte permanent sans perdre sa progression.

### Phase 3 (long terme — intégration BitLab)

- Partage d'identité BitQuest → BitLab via **JWT courte durée signé par BitQuest** passé en query string lors du deep-link. BitLab n'authentifie pas, il transmet simplement cet ID dans la preuve retournée.

---

## 5. Logique métier (domain layer)

### 5.1 Progression engine (existant à préserver)

- `awardXp(userId, amount, source)` reste la fonction unique d'attribution d'XP.
- `awardSats(userId, amount, streak, questTitle)` idem.
- `evaluateBadges(userId)` reste l'évaluateur central, appelé après chaque action impactante.
- **Idempotence** : ajouter un paramètre `idempotencyKey` optionnel qui empêche la double attribution (ex. deux calls réseau concurrents sur `mission_submit`).

### 5.2 Mission engine

- Conserver `generateMission` / `validateMission` pour les **missions simulées** (phase 1 — déjà fonctionnelles).
- Ajouter en phase 2 un second type de mission : **mission BitLab**, dont la validation ne passe plus par comparaison "expected == answer" mais par **vérification de preuve publique** :
  - `verifyTxid(network, txid, criteria)` → requête `mempool.space/{network}/api/tx/{txid}`.
  - `verifyBolt11(network, bolt11, criteria)` → décodage `bolt11` + vérification montant/description.
  - `verifyNodeOpened(network, channelOutpoint)` → optionnel.
- Un `missionType` est désormais `SIMULATED` ou `BITLAB_PROOF`.

### 5.3 Reward engine

- Phase 1 : identique à l'existant (compteur `User.sats`).
- Phase 2 (optionnelle, avec feature flag) : **récompense Lightning testnet** pilotée par un service `LightningRewardService` qui parle à un nœud LDK contrôlé côté serveur (jamais dans le navigateur). Réserve séparée, plafonds par utilisateur (10k sats/jour, 50k sats/mois), KYC-léger (vérification email + streak minimal).
- **Aucune clé privée côté serveur.** Si l'on choisit un modèle custodial, la clé est stockée dans un HSM / KMS cloud. Décision à prendre avant implémentation.

### 5.4 Quest state machine

Machine à états actuelle (`AVAILABLE → IN_PROGRESS → THEORY_DONE → QUIZ_PASSED → COMPLETED`) → conservée.

Ajouts :
- Transition `COMPLETED → MASTERED` après N re-réussites parfaites (optionnel).
- Transition explicite vers `LOCKED` pour les quêtes dont un prérequis a été retiré (admin).

---

## 6. Frontend

### 6.1 Du SPA monopage à de vraies pages App Router

Actuellement `src/app/page.tsx` fait tout. On passe à :

```
src/app/
├─ (public)/
│  ├─ page.tsx                   # Landing
│  ├─ login/
│  ├─ signup/
│  └─ about/
├─ (app)/
│  ├─ layout.tsx                 # Shell authentifié
│  ├─ dashboard/
│  ├─ academy/
│  │  ├─ page.tsx                # Liste des cours
│  │  └─ [courseSlug]/
│  │     └─ [chapterSlug]/
│  │        └─ [lessonSlug]/     # Lecteur de leçon
│  ├─ quests/
│  │  ├─ page.tsx                # Quest map
│  │  └─ [code]/
│  │     └─ page.tsx             # Quest player (SSR, SEO)
│  ├─ wallet/
│  ├─ leaderboard/
│  └─ profile/
├─ (admin)/
│  └─ admin/
│     ├─ layout.tsx              # Guard requireRole("ADMIN|EDITOR")
│     ├─ courses/
│     ├─ chapters/
│     ├─ lessons/
│     ├─ quests/
│     ├─ badges/
│     ├─ users/
│     ├─ audit-log/
│     └─ dashboard/
└─ api/
   ├─ auth/                      # existant durci
   ├─ me/, wallet/, leaderboard/ # existants
   ├─ quests/[code]/progress/    # existant
   ├─ academy/                   # nouveau
   ├─ admin/                     # nouveau, protégé requireRole
   └─ bitlab/
      ├─ challenge/              # issue a challenge JWT
      └─ proof/                  # receive proof + verify
```

**Bénéfices** : URL partageables, SSR pour le SEO des cours, découpage code-split naturel, meilleure navigation back/forward.

### 6.2 Composants

- Conserver les 10 composants métier actuels dans `src/components/bitquest/`.
- Nettoyer les 36 primitives shadcn/ui non utilisées.
- Introduire un **Content Renderer MDX** (`<LessonContent />`) utilisant `@mdxeditor/editor` en mode éditeur dans l'admin, et `react-markdown` + plugin MDX en mode lecture apprenant.
- **Accessibilité** : audit a11y systématique sur chaque composant, tests `jest-axe` ou `@axe-core/react`.

### 6.3 State management

- Conserver Zustand pour la **session** et le **thème**.
- Conserver TanStack Query pour le **cache API**.
- Retirer la navigation SPA (gérée désormais par le routeur).
- Zustand store devient beaucoup plus léger : juste `{ user, csrfToken }` hydraté au boot via un endpoint `GET /api/me`.

---

## 7. i18n

- Activer `next-intl` v4.
- Structure `messages/{locale}/{namespace}.json` avec namespaces : `common`, `landing`, `academy`, `quest`, `admin`, `errors`.
- 3 locales ciblées : `fr` (défaut), `en`, `wo` (wolof, progressif).
- Ajouter un middleware de locale + un sélecteur dans le shell.
- **Contenu pédagogique** : traduit via un modèle `LocaleString` ou via champs `title_fr`, `title_en`, `title_wo` sur `Quest` / `Lesson`. **Recommandation** : champs typés par locale (plus simple en Prisma, plus lisible).

---

## 8. Admin

### 8.1 Authentification

- Guard `requireRole("ADMIN" | "EDITOR")` sur `/admin/*`.
- Route `POST /api/admin/promote` réservée aux ADMIN, journalisée dans `AdminAuditLog`.

### 8.2 CRUD couverts

| Entité | CRUD | Éditeur spécifique |
|---|---|---|
| Course | Oui | Simple |
| Chapter | Oui | Simple + réordonnancement DnD (`@dnd-kit` déjà installé) |
| Lesson | Oui | **Éditeur MDX** (`@mdxeditor/editor`), upload d'assets vers S3/R2, preview SSR |
| Quest | Oui | Builder : intro + theorySections + missionType + missionConfig |
| QuizQuestion | Oui | Formulaire par type (MCQ, MULTI, TRUE_FALSE, LOGIC) |
| Badge | Oui | Selector d'icône Lucide |
| User | Lecture + rôles | Impossible de supprimer, soft delete (`deletedAt`) |
| DailyChallenge | Oui | Calendrier |
| WeeklyChallenge | Oui | Calendrier semaine |
| AuditLog | Lecture seule | Filtres par acteur / action / entité |

### 8.3 Dashboard admin

- Stats globales (DAU, quêtes complétées / jour, sats distribués / jour).
- Alerte d'abus (users avec > 10 missions complétées en 1h, etc.).
- Export CSV.

---

## 9. Intégration BitLab (résumée — détail dans `BITQUEST_INTEGRATION_BITLAB.md`)

Approche retenue : **Lien profond + JWT challenge/response + validation serveur**.

1. BitQuest émet un `MissionChallenge` (JWT signé, expiry 1h, contient `userId`, `questCode`, `requiredAction`, `network`).
2. Deep-link `https://bitlab.gandalnexus.io/?mission=<missionId>&challenge=<jwt>&returnTo=<url>`.
3. BitLab lit le challenge, précharge l'UI appropriée (tx-builder, lightning…), **n'exécute rien de confidentiel**.
4. L'utilisateur agit (construit une tx, ouvre un canal, mine un bloc regtest…).
5. BitLab renvoie une preuve : `txid` / `bolt11` / `blockHash` via `postMessage` ou redirection.
6. BitQuest vérifie la preuve côté serveur contre mempool.space (ou bibliothèque bolt11-decoder) et marque la quête `COMPLETED`.
7. Preuve persistée dans `BitLabProof`.

**Avantages** : zéro clé privée traverse les deux apps, pas de SSO complexe, validation indépendante.

---

## 10. Observabilité et opérations

- **Logs structurés** : `pino` côté serveur, logs JSON.
- **Erreurs** : Sentry (self-hosted ou cloud) — plan à décider.
- **Metrics** : endpoint `/api/metrics` Prometheus-compatible.
- **Health checks** : `/api/health` (DB + Redis).
- **Backups** : snapshot Postgres quotidien, retention 7 jours.

---

## 11. Qualité logicielle

| Pratique | Outil | Statut |
|---|---|---|
| Lint TS/JS | `oxlint` + `eslint` | ✅ Déjà configuré |
| Format | `prettier` | ✅ Déjà configuré |
| Type check | `tsc --noEmit` | ❌ Non câblé, `ignoreBuildErrors: true` à retirer |
| Tests unitaires | `vitest` | ⚠️ Config à corriger + rédiger |
| Tests E2E | `playwright` | ❌ À introduire |
| Tests a11y | `@axe-core/playwright` | ❌ À introduire |
| CI | GitHub Actions | ❓ `.github/` présent, à vérifier |
| Pre-commit | `lefthook` ou `husky` + `lint-staged` | ❌ À introduire |
| Code coverage | Codecov ou local | ❌ À introduire |

---

## 12. Sécurité (consolidation par phases)

**Phase 1 (immédiate)** :
- Cookie `httpOnly` + CSRF.
- Zod partout.
- Désactiver `ignoreBuildErrors`.
- Rate limit Redis.
- Audit des dépendances (`npm audit`, `snyk`).

**Phase 2 (BitLab reward)** :
- Mise en place du `LightningRewardService` isolé.
- Double validation (preuve mempool + signature serveur avant mint du reward).
- Plafonds journaliers / hebdomadaires / par IP / par user.
- Détection d'abus (ML-léger ou règles simples : < X min entre 2 quêtes = suspicion).

**Phase 3 (industrialisation)** :
- Pentest externe.
- Programme de bug bounty (déjà annoncé dans `SECURITY.md`, à activer).
- Rotation des secrets.

---

## 13. Conformité au cahier des charges

| Exigence CdC | Phase cible | Mapping architecture |
|---|---|---|
| §2.1 Comptes (email, Nostr, wallet, invité) | 1 + 2 | Phase 1 : email + invité. Phase 2 : Nostr via NextAuth v5 |
| §2.2 Quêtes (intro / théorie / mini-quiz / mission BitLab / validation) | 1 + 3 | Phase 1 : simulation. Phase 3 : BitLab proof |
| §2.3 XP, niveaux, badges | ✅ déjà fait | Preserve existant |
| §2.4 Quiz (QCM, V/F, logique) | 2 | Étendre `QuizQuestion.type` + UI |
| §2.5 Intégration BitLab | 3 | Section 9 ci-dessus |
| §2.6 Wallet pédagogique Lightning | 2 ou 3 | Feature flag, service dédié |
| §3.1 Stack (Drizzle, Postgres) | Partiel | **On garde Prisma**, on migre vers Postgres |
| §3.2 Logique métier | ✅ existant | Preserve |
| §3.3 WebLN + rate limit | 3 | Phase 3 |
| §4 Sécurité | 1 à 3 | Section 12 |
| §5 UI/UX | 1 | Pages App Router, i18n, a11y |
| §6 Évolutions futures (leaderboards, Nostr, certifications) | 2 et au-delà | Prévu dans le modèle |
| §7 Vision RPG | Transversal | Preserve le ton ludique de l'existant |

**Désaccord assumé avec le CdC** : Prisma est préféré à Drizzle. Rationnel : Prisma est déjà intégré de bout en bout, retirer représente plusieurs semaines de travail risqué sans bénéfice métier. Si cette décision est refusée, un changement d'ORM doit être tracé comme un chantier à part dans la roadmap.

---

## 14. Décisions architecturales à valider

1. **Prisma conservé** (vs. migration Drizzle).
2. **Postgres via Docker en dev**, hébergement serverless en prod à définir (Neon, Supabase, Railway…).
3. **Deux domaines séparés** `bitquest.gandalnexus.io` et `bitlab.gandalnexus.io`, pas de monorepo dans un premier temps.
4. **Pas de récompense Lightning réelle en phase 1.**
5. **i18n contenu** via champs typés par locale (`title_fr`, `title_en`) plutôt que table `LocaleString` — plus simple, moins de jointures.
6. **Monorepo différé.** À réévaluer après la mise en production conjointe BitQuest + BitLab.

---

**Rédigé le** : 2026-11-09
**Prochain livrable** : `BITQUEST_FEATURE_MATRIX.md`
