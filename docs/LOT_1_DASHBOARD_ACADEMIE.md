# Lot 1 — Dashboard & Académie — plan d'attaque

**Date** : 2026-11-09
**Branche cible** : `phase-1-lot-1` (à créer après validation)
**Prérequis** : Phase 0 hygiène terminée (commits `34b994b` → `2d2a987`), environnement Docker opérationnel.
**Référence** : `docs/BITQUEST_ROADMAP.md` (Phases 1 & 2), `docs/BITQUEST_FEATURE_MATRIX.md`.

---

## 1. Audit de l'existant

### 1.1 Dashboard (`src/components/bitquest/dashboard.tsx`, 451 lignes)

Le dashboard **existe et est fonctionnel**. Il est composé de :

| Bloc | Contenu | État |
|---|---|---|
| **Hero** | Salutation personnalisée + anneau de niveau SVG + XP + XP restant jusqu'au niveau suivant | ✅ Opérationnel |
| **4 StatCards** | XP total, quêtes terminées (X/Y), badges débloqués, solde sats | ✅ Opérationnel |
| **Continuer l'apprentissage** | Picker intelligent de la prochaine quête (status priority : IN_PROGRESS → THEORY_DONE → QUIZ_PASSED → AVAILABLE), CTA "Commencer / Reprendre" | ✅ Opérationnel |
| **Progression par parcours** | 4 barres de progression (INITIATION, INTERMEDIATE, ADVANCED, SPECIAL) avec compteur done/total | ✅ Opérationnel |
| **Badges récents** | 4 derniers badges avec icône Lucide + nom + rareté stylée | ✅ Opérationnel |
| **Activité récente** | 8 derniers événements (QUEST_COMPLETED, BADGE_UNLOCKED, LEVEL_UP, SATS_EARNED), timeline avec icônes + temps relatif FR | ✅ Opérationnel |
| **Streak footer** | Indicateur discret série de X jours | ✅ Opérationnel |

**Composants réutilisables** (dans `src/components/bitquest/ui-bits.tsx`) :
- `LevelRing`, `StatCard`, `RewardChips`, `BadgeIcon`, `EmptyState`, `ErrorState`, `LoadingState`
- `rarityStyles`, `statusLabels`, `trackStyles` (styles par enum)

**Dépendances** :
- Hooks : `useMe()`, `useQuests()` via TanStack Query (`src/lib/bitquest/hooks.ts`).
- Shell : utilise `AppShell` via le parent `src/app/page.tsx`.
- Navigation : fonction `onNavigate(view)` passée en prop, pilote le store Zustand.

**Points d'amélioration identifiés** (par ordre de valeur produit) :

| # | Amélioration | Effort | Impact |
|---|---|---|---|
| D1 | **Bannière "Défi du jour"** si `DailyChallenge` existe (en attente du modèle) | M | Haut (rétention) |
| D2 | **Lien direct vers l'Académie** (CTA ou tuile), inexistant actuellement | S | Haut (parcours apprenant) |
| D3 | **État vide améliorée** quand `recentEvents.length === 0` pour les nouveaux comptes (avec CTA vers première quête) | S | Moyen |
| D4 | **Micro-interactions** sur hover des StatCards (déjà en Framer Motion, à peaufiner) | S | Faible |
| D5 | **Section "Prochaine leçon"** côté Académie (hors scope tant que les modèles n'existent pas) | — | Dépend B1 |
| D6 | **Accessibilité** : vérifier contraste `text-muted-foreground`, ajouter `role="region"` sur les sections principales | S | Moyen |
| D7 | **Deep-link vers une quête** via URL (`/quests/[code]`) au lieu du store SPA uniquement | L | Haut (SEO + partage) |
| D8 | **Loading skeleton** (au lieu du `LoadingState` plein écran) pour éviter le flash | M | Moyen |

### 1.2 Académie — inexistante

**Rien n'existe** pour l'Académie :

- Aucune route `/academy` (vérifié : `ls src/app/` ne contient que `api/`, `layout.tsx`, `page.tsx`, `global-error.tsx`, `globals.css`).
- Aucun modèle Prisma pour `Course`, `Chapter`, `Lesson` (vérifié : `prisma/schema.prisma` ne contient que les 8 modèles actuels).
- Aucun composant côté client.
- Aucune API dédiée.

Le CdC et la roadmap (Phase 2) prévoient :
- `Course` (parcours thématique) → contient plusieurs `Chapter`
- `Chapter` (ex. "La propriété numérique") → contient plusieurs `Lesson` et peut lier des `Quest`
- `Lesson` (contenu MDX avec objectifs, prérequis, assets)
- `LessonProgress` (par utilisateur × leçon)
- `LessonAsset` (images, schémas, vidéos — via upload S3/R2)

Le contenu pédagogique actuel est **entièrement contenu dans les 11 quêtes seed** (`src/lib/seed-data.ts`, champ `theorySections`). L'Académie viendra enrichir et structurer ce contenu au-dessus des quêtes.

---

## 2. Principes directeurs du Lot 1

1. **Incrémental et testable.** Chaque sous-tâche se termine par un `npm run lint && npm run typecheck && npm test` vert + éventuellement une vérif UI manuelle via Docker.
2. **Pas de régression.** Le Dashboard existant reste 100 % fonctionnel à chaque étape. Les améliorations D1–D8 sont ajoutées, pas substituées.
3. **Pas de modification des règles métier** (`progression.ts`, `missions.ts`, `quests.ts`). Lecture seule.
4. **Pas de migration PostgreSQL** (reste SQLite pour ce lot).
5. **L'Académie démarre par la lecture** (listing + navigation) — pas d'éditeur MDX dans ce lot (celui-ci est en Phase 2 admin).
6. **Zéro donnée fictive** dans les composants finaux. Si une donnée réelle manque, on n'affiche pas plutôt que d'inventer.
7. **Tout passe par Docker** (conteneur `bitquest-dev` déjà configuré).

---

## 3. Découpage proposé — 3 sprints séquentiels

### Sprint 1A — Dashboard : améliorations à moindre risque (1 journée)

**Objectif** : rendre le dashboard plus actionnable sans toucher aux modèles de données.

#### Tâche D2 — Tuile "Académie" dans le dashboard (shim)
- Ajouter une section "Approfondir avec l'Académie" **désactivée** (grisée + badge "Bientôt disponible") pour préparer la Phase 2.
- Pas de route cible encore — le CTA est inerte à ce stade.
- Fichier : `src/components/bitquest/dashboard.tsx` + nouvelle sous-composante dans `ui-bits.tsx`.

#### Tâche D3 — États vides enrichis
- Si `recentEvents.length === 0` ET `completedQuests.length === 0` → afficher un onboarding court (3 pas : quiz → mission → récompense) avec CTA "Commencer la quête Genesis".
- Fichier : `src/components/bitquest/dashboard.tsx`.

#### Tâche D6 — Accessibilité du dashboard
- Ajouter `role="region"` + `aria-labelledby` sur chaque section.
- Vérifier le contraste des `text-muted-foreground` sur les cartes (audit visuel manuel).
- Rajouter des `aria-live="polite"` sur les événements qui se chargent dynamiquement.
- Fichier : `src/components/bitquest/dashboard.tsx`.

**Tests ajoutés** :
- `src/components/bitquest/__tests__/dashboard.test.tsx` — rendu minimal avec mock des hooks (3-5 tests).

**Critère d'acceptation sprint 1A** :
- Tests toujours à 25+ passants.
- Lighthouse accessibilité manuel ≥ 90.
- Aucune régression des 7 blocs existants.

---

### Sprint 1B — Fondations Académie (lecture seule) (2-3 journées)

**Objectif** : poser le modèle de données, créer les routes publiques, afficher un catalogue + une leçon placeholder. Sans éditeur, sans upload.

#### Tâche B1 — Modèles Prisma
- Ajouter `Course`, `Chapter`, `Lesson`, `LessonProgress` dans `prisma/schema.prisma`.
- Relations :
  - `Course 1-n Chapter`
  - `Chapter 1-n Lesson`
  - `Chapter n-n Quest` (optionnel, via table pivot `ChapterQuest`)
  - `User 1-n LessonProgress`
- Index : `Chapter(courseId, order)`, `Lesson(chapterId, order)`, `LessonProgress(userId, lessonId)` (unique composite).
- **DB** : SQLite. Commande : `npx prisma db push` (ou pas, selon la consigne — à valider avec l'utilisateur ; je propose `db push` pour ce sprint uniquement, documentée dans le rapport).
- **Seed** : ajouter 1 cours "Fondamentaux Bitcoin" × 2 chapitres × 3 leçons chacun, totalement en français. Le contenu Lesson peut être du Markdown en texte brut (pas de MDX avancé).
- Fichiers : `prisma/schema.prisma`, `prisma/seed.ts`, nouveau `src/lib/bitquest/academy.ts` (requêtes typées).

#### Tâche B2 — Route API publique
- `GET /api/academy/courses` → liste des cours (public, pas d'auth requise).
- `GET /api/academy/courses/[slug]` → détail avec arbre `chapters[].lessons[]`, et pour l'utilisateur authentifié : les `LessonProgress`.
- `POST /api/academy/lessons/[id]/complete` → marque une leçon comme lue (authentifié).
- Validation Zod sur les params.
- Fichiers : `src/app/api/academy/**/route.ts`.

#### Tâche B3 — Pages catalog + reader (vraies pages App Router)
- `src/app/academy/page.tsx` — SSR, catalogue des cours, cards avec titre, description, nombre de chapitres/leçons.
- `src/app/academy/[courseSlug]/page.tsx` — sommaire d'un cours + barre de progression.
- `src/app/academy/[courseSlug]/[chapterSlug]/[lessonSlug]/page.tsx` — lecteur de leçon (rendu Markdown via `react-markdown`, déjà en deps).
- Navigation : "Leçon précédente / suivante", "Retour au sommaire".
- Bouton "Marquer comme lue" (appelle `POST /complete`, invalide le cache TanStack Query).
- Fichiers : nouveaux fichiers `src/app/academy/**/page.tsx`.

#### Tâche B4 — Intégration dashboard
- Activer la tuile "Académie" de la D2 avec un vrai lien vers `/academy`.
- Afficher la prochaine leçon suggérée (première non lue dans le cours commencé).
- Fichier : `src/components/bitquest/dashboard.tsx`.

**Tests ajoutés** :
- `src/lib/bitquest/academy.test.ts` — logique de sélection "prochaine leçon" (fonction pure).
- `src/app/api/academy/__tests__/courses.test.ts` — smoke tests avec mock Prisma.

**Critère d'acceptation sprint 1B** :
- `/academy` affiche 1 cours réel seedé.
- Cliquer sur un cours → sommaire → cliquer sur une leçon → contenu Markdown s'affiche.
- "Marquer comme lue" persiste l'état.
- Le dashboard affiche la tuile Académie active.
- Tests à 30+ passants.

---

### Sprint 1C — Deep-links & hygiène UX (1-2 journées)

**Objectif** : sortir de la navigation SPA pure pour permettre le partage d'URL (D7).

- `src/app/quests/[code]/page.tsx` — route SSR qui monte le `QuestPlayer` existant.
- Mise à jour du `QuestMap` pour pointer vers `/quests/[code]` au lieu d'appeler `openQuest`.
- Conservation du store Zustand pour la session, mais retrait progressif du `view` (remplacé par le routeur).
- `src/app/wallet/page.tsx`, `/leaderboard`, `/profile` idem.
- Mise à jour de `middleware.ts` pour protéger ces nouvelles routes (middleware ré-activé en Phase 1 sécurité, mais on peut déjà l'armer en lecture ici).
- Loading skeletons pour chaque page (D8).

**Critère d'acceptation sprint 1C** :
- URL partageable `http://localhost:3000/quests/genesis` fonctionne.
- Pas de régression sur le dashboard ou le quest player.
- Tests toujours verts.

---

## 4. Risques et points de vigilance

| # | Risque | Mitigation |
|---|---|---|
| R1 | Ajouter les modèles Prisma sans `db push` → client ne les connaît pas | Exécuter `prisma db push --accept-data-loss` sur `db/custom.db` (ajoute colonnes, aucune suppression). **À valider avec l'utilisateur avant.** |
| R2 | `db push` sur une base existante en dev pourrait écraser des données locales | SQLite ajoute des colonnes/tables sans toucher aux existantes. Snapshot `db/custom.db` avant par sécurité. |
| R3 | Changer le routing (sprint 1C) casse le store Zustand actuel | Faire en dernier, tests manuels de chaque vue. |
| R4 | Création de `/academy` route publique = exposition SEO prématurée | Utiliser `robots.txt` ou `<meta name="robots" content="noindex">` tant que le contenu n'est pas validé. |
| R5 | Build Next.js toujours cassé (issue pré-existante) | Hors scope de ce lot, mais à régler en parallèle. |

---

## 5. Hors scope explicite du Lot 1

- Éditeur MDX d'admin (Phase 2).
- Upload d'images / assets pédagogiques (Phase 2).
- Multi-locale (FR/EN) pour les contenus Académie — tout en français dans ce lot.
- Certifications de fin de parcours (Phase 2+).
- Cours dynamiques via admin (toujours en seed dans ce lot).
- Lightning réel (Phase 3+).
- Migration PostgreSQL (après Phase 2).

---

## 6. Décisions à valider avant de coder

1. **Sprint 1A d'abord ou directement 1B ?** Je recommande 1A (low-risk, valeur immédiate, prépare la place pour 1B).
2. **Autorisation d'exécuter `prisma db push --accept-data-loss` sur `db/custom.db`** pour ajouter les tables Academy ? (Aucune donnée existante ne sera supprimée puisque les tables sont nouvelles. Mais c'est la première fois que la Phase 0 impose "ne pas toucher la base" est levée.)
3. **Slug vs id dans les URLs** (`/academy/fondamentaux-bitcoin` vs `/academy/clw123...`) ? Je recommande slug (plus lisible, SEO).
4. **Markdown ou MDX pour les leçons** ? Je recommande Markdown pur dans ce lot (plus simple, pas besoin de l'éditeur MDX en Phase 2 pour lire).
5. **Branche dédiée `phase-1-lot-1`** ou continuer sur `phase-0-docker-setup` ? Je recommande dédiée pour isoler.

---

## 7. Livrable attendu en fin de Lot 1

Un apprenant doit pouvoir :
1. Se connecter.
2. Voir dans son dashboard un onboarding clair + une tuile Académie active.
3. Cliquer sur l'Académie → voir un cours.
4. Cliquer sur le cours → lire un sommaire et commencer la première leçon.
5. Lire une leçon → la marquer comme lue.
6. Voir sa progression dans le dashboard (nouveau indicateur "N leçons lues").
7. Partager une URL de quête (`/quests/genesis`) et y accéder directement.

Tout ça **sans régression** des parcours de quête existants.

---

**Rédigé le** : 2026-11-09
**Prochaine action** : attendre la validation des décisions §6 par Diallo avant de créer la branche `phase-1-lot-1` et d'attaquer le sprint 1A.
