# Roadmap BitQuest — 2026-11-09

> Plan de développement progressif pour transformer BitQuest d'un **MVP éducatif à cœur métier solide** en **plateforme éducative Bitcoin de référence**, complémentaire de BitLab. Basé sur `BITQUEST_AUDIT.md`, `BITQUEST_ARCHITECTURE.md`, `BITQUEST_FEATURE_MATRIX.md` et `BITQUEST_INTEGRATION_BITLAB.md`.
>
> Les phases sont **séquentielles au niveau "jalon livrable"** mais **certaines tâches sont parallélisables** dans chaque phase. Chaque module précise objectif, fonctionnalités, fichiers concernés, dépendances, difficultés, tests et critères d'acceptation.

---

## Vue d'ensemble des phases

| Phase | Durée | Objectif | Livrable gatekeeper |
|---|---|---|---|
| **0 — Hygiène** | 1 semaine | Dépôt propre, prêt à accueillir du vrai travail | Build CI vert, pas de deps mortes, SQLite→Postgres, tests unitaires sur `progression.ts` |
| **1 — Sécurité & robustesse** | 2 semaines | Rendre l'existant déployable en production | Cookie httpOnly + CSRF + Zod + Redis + rôles |
| **2 — Académie & admin** | 7 semaines | Permettre aux éditeurs de produire du contenu | `/academy` + `/admin` CRUD complet + i18n FR/EN |
| **3 — Intégration BitLab** | 2 semaines | Le "practice" devient réel | Une quête complétable par txid testnet4 |
| **4 — Récompenses Lightning** | 6 semaines (optionnel) | Boucle "earn" réelle | Payout Lightning testnet, feature flag |
| **5 — Industrialisation** | 3 semaines | Prêt pour une communauté | Monitoring, E2E, a11y, WO, pentest |

Total : **≈ 21 semaines** (≈ 5 mois) pour un dev full-stack senior solo. En binôme : 3 mois calendaires.

---

## Phase 0 — Hygiène (semaine 1)

### Objectif
Mettre le dépôt dans un état propre et aligné avec la documentation, sans ajouter de fonctionnalité métier.

### Modules

#### 0.1 — Nettoyage du `package.json`
- **Objectif** : retirer la dette "template".
- **Fonctionnalités** :
  - Renommer `nextjs_tailwind_shadcn_ts` → `bitquest`.
  - Retirer `z-ai-web-dev-sdk`.
  - Auditer `next-auth`, `next-intl`, `@mdxeditor/editor`, `@dnd-kit/*`, `recharts`, `embla-carousel-react`, `input-otp`, `react-resizable-panels`, `vaul`.
  - Retirer les 36 primitives `shadcn/ui` non utilisées.
- **Fichiers** : `package.json`, `src/components/ui/*`.
- **Dépendances** : — .
- **Difficultés** : identifier les composants vraiment inutilisés (certains sont re-exportés).
- **Tests** : `npm run build` passe sans erreur.
- **Critères d'acceptation** : `depcheck` ne remonte plus de deps orphelines critiques. Le dossier `src/components/ui/` ne contient que ce qui est importé.

#### 0.2 — Rétablir la vérification TypeScript
- **Objectif** : empêcher la régression silencieuse.
- **Fonctionnalités** :
  - Retirer `typescript.ignoreBuildErrors` de `next.config.ts`.
  - Ajouter script `typecheck: "tsc --noEmit"`.
  - Corriger les erreurs résultantes.
- **Fichiers** : `next.config.ts`, `package.json`, fichiers TS corrigés.
- **Dépendances** : 0.1.
- **Critères** : `npm run typecheck` et `npm run build` passent.

#### 0.3 — Corriger `vitest.config.ts` et poser une baseline
- **Objectif** : rendre les tests exécutables.
- **Fonctionnalités** :
  - Réparer `include` (chemins `src/lib/bitquest/**`, `src/app/api/**`, `middleware.ts`).
  - Créer `__tests__/setup.ts` effectif ou retirer la référence.
  - Écrire les premiers tests sur `src/lib/bitquest/progression.ts` (XP, niveau, streak, `awardSats`).
- **Fichiers** : `vitest.config.ts`, `__tests__/setup.ts`, `src/lib/bitquest/progression.test.ts`.
- **Dépendances** : 0.1.
- **Difficultés** : mocker `db` Prisma (library `vitest-mock-extended` ou `@quramy/prisma-fabbrica`).
- **Critères** : `npm run test` sort vert, couverture > 60 % sur `progression.ts`.

#### 0.4 — Migration SQLite → PostgreSQL + migrations versionnées
- **Objectif** : aligner le code avec le CdC.
- **Fonctionnalités** :
  - Modifier `prisma/schema.prisma` : provider `postgresql`.
  - `prisma migrate dev --name init` → crée `prisma/migrations/`.
  - Confirmer compatibilité `docker-compose.yml` (déjà Postgres 16).
  - Scripts `db:up`, `db:migrate`, `db:seed`, `db:reset` consolidés et documentés.
  - Convertir champs `String` stockant du JSON en `Json` natif dans une migration successive.
- **Fichiers** : `prisma/schema.prisma`, `prisma/migrations/*`, `docker-compose.yml`, `.env.example`.
- **Dépendances** : 0.3 (pour valider que la migration ne casse rien).
- **Difficultés** : conversion silencieuse des `JSON.parse(row.theorySections)` partout dans le code — à remplacer par un accès direct au champ typé.
- **Critères** : `docker compose up -d postgres && npm run db:migrate && npm run db:seed` fonctionne depuis un repo vierge.

#### 0.5 — Corriger `middleware.ts` ou l'effacer
- **Objectif** : plus de code mort trompeur.
- **Fichiers** : `middleware.ts`.
- **Décision** : attendre la phase 1 pour réécrire une fois le cookie posé. En phase 0 : commenter et laisser un TODO explicite.

#### 0.6 — Nettoyage `QuizQuestion.quest2`
- **Objectif** : supprimer champ orphelin.
- **Fichiers** : `prisma/schema.prisma`, migration Prisma.

### Livrable gatekeeper phase 0
```
npm install && npm run lint && npm run typecheck && npm run test && npm run build
```
→ tout passe. Dépôt propre, Postgres en place, baseline de tests posée.

---

## Phase 1 — Sécurité & robustesse (semaines 2-3)

### Objectif
Rendre l'application déployable sans honte en production (interne, puis externe).

### Modules

#### 1.1 — Rôles utilisateur
- **Fonctionnalités** :
  - Enum Prisma `Role { APPRENTICE, EDITOR, ADMIN }`.
  - Champ `User.role` + migration.
  - Helper `requireRole("ADMIN")` + `requireAuthenticated()`.
- **Fichiers** : `prisma/schema.prisma`, `src/lib/bitquest/session.ts`, nouveau `src/lib/auth/roles.ts`.
- **Critères** : un user ADMIN peut être créé via `prisma studio`, tagué dans la session.

#### 1.2 — Session en cookie httpOnly + CSRF
- **Fonctionnalités** :
  - Set-cookie sur login/signup/guest : `session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/`.
  - Clear-cookie sur logout.
  - Lire le cookie (pas les headers custom) dans `authenticate()`.
  - Génération token CSRF (`X-CSRF-Token`) par session, stocké aussi en cookie lisible.
  - Vérification CSRF sur toutes les mutations (`POST`, `PATCH`, `DELETE`).
  - Mise à jour du middleware en conséquence.
- **Fichiers** : `src/app/api/auth/route.ts`, `src/lib/bitquest/session.ts`, `src/lib/bitquest/client.ts`, `middleware.ts`.
- **Dépendances** : 1.1.
- **Difficultés** : migration douce — accepter encore quelques jours les headers legacy pour éviter de déconnecter les testeurs.
- **Critères** : attaque CSRF simulée bloquée en test.

#### 1.3 — Validation Zod aux frontières
- **Fonctionnalités** : un schéma Zod par route API, par Server Action. `parse()` en entrée, typage inféré en sortie.
- **Fichiers** : tous les `src/app/api/**/route.ts`.
- **Tests** : tests unitaires des schémas (payload invalide → 400 propre).

#### 1.4 — Rate limiting Redis
- **Fonctionnalités** :
  - Remplacer la Map en mémoire par un client Redis (Upstash en prod, image locale en dev).
  - Clés par IP (signup/login) et par userId (actions sensibles).
- **Fichiers** : `src/lib/bitquest/session.ts`, nouveau `src/lib/cache/redis.ts`, `docker-compose.yml`.
- **Critères** : test d'intégration qui envoie 101 requêtes en 1 min → la 101e reçoit un 429.

#### 1.5 — Tests unitaires du domain layer
- **Fonctionnalités** :
  - Couverture > 80 % de `src/lib/bitquest/progression.ts`, `missions.ts`, `quests.ts`.
  - Mocks Prisma propres.
- **Critères** : seuil de couverture appliqué en CI.

#### 1.6 — CI GitHub Actions
- **Fonctionnalités** : workflow `ci.yml` : install, lint, typecheck, test, build.
- **Fichiers** : `.github/workflows/ci.yml`.
- **Critères** : chaque PR passe par la CI.

### Livrable gatekeeper phase 1
Un apprenant peut s'inscrire, se connecter via cookie, compléter la quête `genesis` existante, perdre et récupérer sa session proprement. CI verte sur toutes les PR.

---

## Phase 2 — Académie et administration (semaines 4-10)

### Objectif
Permettre à un rédacteur non-dev de produire du contenu pédagogique. C'est la plus grosse phase.

### Modules

#### 2.1 — Modèle de données pédagogique
- **Fonctionnalités** : modèles `Course`, `Chapter`, `Lesson`, `LessonAsset`, `LessonProgress` + migrations.
- **Fichiers** : `prisma/schema.prisma`, `prisma/migrations/*`, `src/lib/bitquest/academy.ts` (nouvelles fonctions `getCourseTree`, `getLessonWithProgress`).
- **Dépendances** : phase 1.
- **Critères** : seed de 1 cours complet (ex. "Fondamentaux Bitcoin") avec 3 chapitres et 6 leçons, affiché via Prisma Studio.

#### 2.2 — Routes publiques `/academy`
- **Fonctionnalités** :
  - `/academy` (catalogue), `/academy/[course]` (sommaire), `/academy/[course]/[chapter]/[lesson]` (lecteur).
  - SSR + ISR pour SEO.
  - Renderer MDX (lecture seule).
  - Progression par leçon (bouton "Marquer comme lue").
- **Fichiers** : `src/app/(app)/academy/**`.
- **Dépendances** : 2.1.
- **Tests** : parcours lecteur → marquer comme lu → progression persistée.

#### 2.3 — Admin shell + guard
- **Fonctionnalités** :
  - Layout `src/app/(admin)/admin/layout.tsx` avec `requireRole`.
  - Sidebar admin, dashboard d'entrée.
  - Audit log (modèle `AdminAuditLog` + middleware qui persiste chaque mutation admin).
- **Fichiers** : `src/app/(admin)/admin/**`, `src/lib/bitquest/admin-audit.ts`.
- **Critères** : un APPRENTICE accédant à `/admin` est redirigé vers 403.

#### 2.4 — CRUD Course / Chapter
- **Fonctionnalités** :
  - Formulaires React Hook Form + Zod.
  - Réordonnancement DnD avec `@dnd-kit` (déjà installé).
  - Preview sommaire.
- **Fichiers** : `src/app/(admin)/admin/courses/**`, `src/app/(admin)/admin/chapters/**`.

#### 2.5 — Éditeur de leçon MDX
- **Fonctionnalités** :
  - Éditeur `@mdxeditor/editor` câblé pour de bon.
  - Upload d'assets (images) vers un stockage S3-compatible (R2 Cloudflare recommandé pour l'Afrique) ou local en dev.
  - Preview en direct SSR.
  - Versioning simple (brouillon / publié).
- **Fichiers** : `src/app/(admin)/admin/lessons/**`, `src/lib/storage/r2.ts`.
- **Difficultés** : sécuriser l'upload (MIME, taille, scan).
- **Critères** : un éditeur peut créer une leçon, ajouter une image, prévisualiser, publier.

#### 2.6 — Admin Quests / Quiz / Badges
- **Fonctionnalités** : CRUD avec builder spécifique par entité (quiz par type MCQ / MULTI / V-F / LOGIC), badge builder (icône Lucide + condition).
- **Fichiers** : `src/app/(admin)/admin/{quests,quiz,badges}/**`.

#### 2.7 — Admin Users
- **Fonctionnalités** : liste, filtres, changement de rôle, soft delete.
- **Critères** : opération journalisée dans `AdminAuditLog`.

#### 2.8 — Défis quotidiens / hebdomadaires
- **Fonctionnalités** :
  - Modèles `DailyChallenge`, `WeeklyChallenge`.
  - Cron (Vercel cron ou GitHub Actions scheduled) qui sélectionne un défi actif.
  - UI dashboard : "Défi du jour", "Défi de la semaine".
- **Fichiers** : nouveau `src/lib/bitquest/challenges.ts`, nouvelle route `src/app/api/challenges/**`.

#### 2.9 — Internationalisation FR / EN
- **Fonctionnalités** :
  - Activer `next-intl`.
  - Middleware locale.
  - Dictionnaires `messages/fr/*.json`, `messages/en/*.json`.
  - Sélecteur de langue.
  - Contenu pédagogique multilingue (champs `_fr`, `_en` sur `Lesson`, `Quest`).
- **Fichiers** : `src/i18n/*`, `next.config.ts`, `src/app/**`.
- **Difficultés** : toucher tous les composants existants (long mais systématique).

### Livrable gatekeeper phase 2
Un éditeur peut créer un cours complet dans l'admin (sans coder), ajouter une image, poser un quiz, lier une quête. Un apprenant navigue le cours en FR ou EN, suit sa progression, complète la quête.

---

## Phase 3 — Intégration BitLab (semaines 11-12)

### Objectif
Première mission réellement validée par une action BitLab.

### Modules

#### 3.1 — Modèle de preuve
- **Fonctionnalités** : `BitLabProof`, `RewardIdempotencyKey`, champ `missionKind: SIMULATED | BITLAB_PROOF` sur `Quest`.
- **Fichiers** : `prisma/schema.prisma`, migration.

#### 3.2 — Service `MempoolClient`
- **Fonctionnalités** : fetch `mempool.space/{network}/api/tx/{txid}`, `.../block/{hash}`, timeouts, retries, fallback `blockstream.info`.
- **Fichiers** : `src/lib/bitlab/mempool.ts`.
- **Tests** : mock HTTP.

#### 3.3 — Décodeur BOLT11
- **Fonctionnalités** : choisir une lib (`bolt11` npm, `@scure/btc-signer` offre quelque chose aussi), vérifier montant/description.
- **Fichiers** : `src/lib/bitlab/bolt11.ts`.

#### 3.4 — Routes challenge/proof
- **Fonctionnalités** :
  - `POST /api/bitlab/challenge` : émet un JWT signé HS256 (expiry 1h, nonce).
  - `POST /api/bitlab/proof` : vérifie JWT, consomme nonce, vérifie preuve, attribue récompenses, marque quête `COMPLETED`.
- **Fichiers** : `src/app/api/bitlab/challenge/route.ts`, `src/app/api/bitlab/proof/route.ts`.
- **Tests** : scénarios replay, expiry, preuve invalide, double consommation.

#### 3.5 — UI deep-link
- **Fonctionnalités** : bouton "Ouvrir dans BitLab" dans `mission-panel.tsx` pour les quêtes `BITLAB_PROOF`. Nouvel onglet. État "en attente de preuve".
- **Fichiers** : `src/components/bitquest/mission-panel.tsx`.

#### 3.6 — Documentation apprenant
- **Fichiers** : `docs/user-guide/mission-bitlab.md` + traduction EN.

#### 3.7 — Pilote : convertir la quête `tx-basics`
- **Fonctionnalités** : marquer `tx-basics.missionKind = BITLAB_PROOF`, configurer l'exercice (adresse testnet attendue, montant min).

### Livrable gatekeeper phase 3
Un apprenant complète la quête `tx-basics` en construisant une vraie transaction dans BitLab sur Testnet4 ; la quête bascule `COMPLETED` quand mempool.space confirme la tx.

---

## Phase 4 — Récompenses Lightning (semaines 13-18, OPTIONNELLE)

### Objectif
Boucle "earn" réelle : des satoshis Testnet distribués par BitQuest.

> Cette phase nécessite une décision produit et une validation sécurité dédiée. **À engager uniquement si le modèle économique et la gouvernance (qui finance le testnet pool ?) sont tranchés.**

### Modules synthétiques
- Nœud LDK ou LND maîtrisé côté serveur BitQuest (pas dans le navigateur).
- Service `LightningRewardService` isolé.
- Modèle `Payout` + idempotence.
- Feature flag `LIGHTNING_REWARDS_ENABLED`.
- Plafonds journaliers / hebdomadaires / par IP / par user.
- KYC-léger (vérification email, streak minimal, quêtes débloquées).
- Audit sécurité externe avant mise en ligne.

### Livrable gatekeeper phase 4
Un apprenant qualifié reçoit N sats Testnet sur une invoice Lightning qu'il fournit, sans intervention humaine, avec une piste d'audit complète.

---

## Phase 5 — Industrialisation (semaines 19-21)

### Objectif
Prêt pour une communauté : monitoring, tests E2E, accessibilité, locale WO, pentest.

### Modules

#### 5.1 — Observabilité
- Sentry (frontend + backend).
- `pino` logs structurés.
- Metrics Prometheus-compatible.
- Health check `/api/health`.

#### 5.2 — Tests E2E Playwright
- Scénarios : signup → première quête complétée, flow quiz raté/repassé, flow mission BitLab, flow admin édition de leçon.

#### 5.3 — Audit a11y
- `@axe-core/playwright` sur les pages principales.
- Corrections jusqu'à WCAG AA.

#### 5.4 — Locale Wolof
- `messages/wo/*.json` (collaboration avec un contributeur locuteur).
- Contenu pédagogique au moins pour le cours "Fondamentaux Bitcoin".

#### 5.5 — Pentest externe
- Deuxième équipe. Rapport. Correctifs.

#### 5.6 — Bug bounty actif
- Annoncer publiquement, aligner `SECURITY.md`.

### Livrable gatekeeper phase 5
BitQuest en production ouverte, communauté active, monitoring pleinement opérationnel.

---

## Premières tâches à entreprendre immédiatement (sprint 1, 5 jours)

Ce sont les tâches que je recommande de démarrer **dès que ce plan est validé**. Elles correspondent intégralement à la Phase 0.

| # | Tâche | Fichiers impactés | Estimation |
|---|---|---|---|
| 1 | Retirer `z-ai-web-dev-sdk` et renommer `package.json.name` → `bitquest` | `package.json` | 0,5 h |
| 2 | Lancer `depcheck` et retirer les deps vraiment inutilisées (`@dnd-kit` si pas utilisé, `next-auth` v4 si on part sur maison, etc.) | `package.json` | 2 h |
| 3 | Retirer `ignoreBuildErrors: true` et corriger les erreurs TS qui apparaissent | `next.config.ts`, divers | 4-8 h |
| 4 | Corriger `vitest.config.ts` (chemins réels sous `src/`) + écrire le premier test sur `src/lib/bitquest/progression.ts` | `vitest.config.ts`, `__tests__/setup.ts`, `src/lib/bitquest/progression.test.ts` | 4 h |
| 5 | Retirer le champ orphelin `QuizQuestion.quest2` + migration | `prisma/schema.prisma`, nouvelle migration | 1 h |
| 6 | Migrer `prisma/schema.prisma` vers `postgresql` + créer la migration `init` + mettre à jour `.env.example` | `prisma/*`, `.env.example` | 4 h |
| 7 | Nettoyer `src/components/ui/` : retirer les 36 primitives non importées | `src/components/ui/*` | 2 h |
| 8 | Créer `.github/workflows/ci.yml` (lint + typecheck + test + build) | `.github/workflows/` | 2 h |
| 9 | Documenter dans le `README.md` la **vraie** stack (Prisma + Postgres) + mentionner que les sats sont pédagogiques | `README.md`, `CHANGELOG.md` | 2 h |
| 10 | Commenter `middleware.ts` avec un TODO explicite pour Phase 1 | `middleware.ts` | 15 min |

**Livrable sprint 1** : dépôt propre, build vert, CI active, tests qui tournent, Postgres en place, documentation honnête.

---

## Gouvernance et suivi

- **Suivi tâches** : un issue GitHub par module ; label `phase/0`, `phase/1`, etc.
- **Revue** : revue hebdomadaire de la roadmap, ajustement des estimations.
- **Décisions architecturales** : chaque décision significative documentée en `docs/adr/NNNN-titre.md` (Architecture Decision Record).
- **Communication produit** : avant la Phase 2, annoncer publiquement que l'intégration BitLab est "en cours" (ne pas laisser le README actuel mentir sur ce point).

---

## Hypothèses et risques transversaux

- **Hypothèse 1** : on conserve Prisma (vs. Drizzle). Si cette décision est annulée, prévoir +3 semaines pour la migration ORM.
- **Hypothèse 2** : BitLab est modifiable pour la Phase 3 (deep-link + hook preuve). Si non, bascule vers l'alternative "copier-coller" de l'option B dégradée (voir `BITQUEST_INTEGRATION_BITLAB.md` §8).
- **Hypothèse 3** : hébergement cible décidé avant la Phase 2 (Vercel ? Railway ? auto-hébergé ? impact sur Redis, S3, cron).
- **Hypothèse 4** : budget humain d'un dev senior full-stack à plein temps. Toute variation (à temps partiel, en binôme) demande un ré-échelonnement.
- **Hypothèse 5** : pas de pivot produit majeur. Si Nostr, certification formelle ou marketplace sont priorisés (voir Manifeste), ce sont des phases 4+ dédiées.

---

**Rédigé le** : 2026-11-09
**Suite** : exécuter la Phase 0 et revalider le plan après chaque jalon gatekeeper.
