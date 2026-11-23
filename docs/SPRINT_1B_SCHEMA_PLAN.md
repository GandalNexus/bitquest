# Sprint 1B — Schéma Académie + plan de migration additive

**Date** : 2026-11-09
**Branche** : `phase-1-lot-1` (continue le Sprint 1A, commit `00cce1e`)
**Pré-requis** : Phase 0 + Sprint 1A validés, Docker up, `db/custom.db` intacte.

> ⚠️ **Aucune modification de code ni de base ne sera effectuée tant que ce plan n'est pas validé.**

---

## 1. Objectifs de Sprint 1B

Poser les fondations de l'Académie en lecture seule :
- Modèles Prisma pour un parcours hiérarchique Cours → Chapitres → Leçons.
- Suivi de progression par utilisateur × leçon.
- (Optionnel) lien faible Chapitre ↔ Quête pour marier théorie académique et pratique gamifiée.
- Routes API publiques + routes SSR `/academy/**`.
- Lecteur Markdown.
- Seed d'un premier cours réel (« Fondamentaux Bitcoin »).

Ce document ne traite **que** la partie schéma + migration. Les routes et pages seront produites dans un sous-sprint suivant après validation du modèle.

---

## 2. Principes directeurs du schéma

1. **Additif strictement.** Aucune modification des 8 modèles existants (`User`, `Quest`, `QuizQuestion`, `UserQuestProgress`, `Badge`, `UserBadge`, `WalletTransaction`, `UserEvent`).
2. **Compatibilité SQLite.** Pas d'enums natifs (utilisation de `String` avec commentaire d'énumération, comme pour `Quest.track`, `Badge.rarity`, etc.). JSON stocké en `String` (cohérent avec l'existant).
3. **Back-refs optionnelles.** Les nouvelles relations ajoutent des champs *relation* sur `User` et `Quest`. Ce sont des champs purement logiques côté Prisma, qui **ne génèrent aucune colonne** dans la base : donc techniquement toujours additifs.
4. **Slugs stables** côté URL : chaque leçon est adressable par `/academy/[courseSlug]/[chapterSlug]/[lessonSlug]`. Unicité composite pour éviter les collisions.
5. **Pas de suppression en cascade silencieuse.** Les relations critiques utilisent `onDelete: Restrict` par défaut (empêche de supprimer un cours qui contient encore des leçons progressées).
6. **Pas de MDX dans le modèle.** Le champ `content` d'une leçon stocke du Markdown pur (string). MDX viendra dans le sprint admin (phase 2).

---

## 3. Modèles proposés

### 3.1 `Course`

Un parcours thématique. Ex. « Fondamentaux Bitcoin », « Lightning Network », « Sécurité des clés ».

```prisma
model Course {
  id          String   @id @default(cuid())
  slug        String   @unique                 // ex. "fondamentaux-bitcoin"
  title       String                            // "Fondamentaux Bitcoin"
  subtitle    String                            // Phrase courte (hero du cours)
  description String                            // Paragraphe long (page catalogue)
  coverIcon   String   @default("BookOpen")    // nom d'icône Lucide (comme Badge.icon)
  order       Int                               // ordre d'affichage dans le catalogue
  publishedAt DateTime?                         // null = brouillon (non listé publiquement)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  chapters    Chapter[]
}
```

**Raisons des choix :**
- `slug` séparé du `id` → URLs lisibles et SEO-friendly.
- `publishedAt` nullable → support simple « brouillon vs publié » sans table Status.
- `coverIcon` réutilise la convention `Badge.icon` (nom Lucide) : pas de nouvelle convention à introduire.

### 3.2 `Chapter`

Une section d'un cours.

```prisma
model Chapter {
  id        String   @id @default(cuid())
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Restrict)
  slug      String                               // ex. "propriete-numerique"
  title     String                               // "La propriété numérique"
  summary   String                               // 1-2 phrases visibles dans le sommaire
  order     Int                                  // position dans le cours

  lessons       Lesson[]
  linkedQuests  ChapterQuest[]

  @@unique([courseId, slug])                    // slug unique dans son cours
  @@index([courseId, order])
}
```

**Raisons :**
- Unicité composite `(courseId, slug)` : deux cours peuvent avoir un chapitre `introduction` sans collision.
- Index `(courseId, order)` : lecture rapide du sommaire.

### 3.3 `Lesson`

Une leçon atomique.

```prisma
model Lesson {
  id          String   @id @default(cuid())
  chapterId   String
  chapter     Chapter  @relation(fields: [chapterId], references: [id], onDelete: Restrict)
  slug        String                              // ex. "pourquoi-bitcoin"
  title       String                              // "Pourquoi Bitcoin ?"
  summary     String                              // phrase visible dans le sommaire
  content     String                              // Markdown pur
  estimatedMinutes Int   @default(5)              // temps de lecture estimé
  order       Int                                 // position dans le chapitre
  publishedAt DateTime?                           // null = brouillon
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  progress    LessonProgress[]

  @@unique([chapterId, slug])
  @@index([chapterId, order])
}
```

**Raisons :**
- `content: String` → Markdown pur. Rendu via `react-markdown` (déjà en deps).
- `estimatedMinutes` → affichage « 5 min » dans le sommaire, aide l'apprenant à planifier.
- Pas de `theorySections` JSON comme Quest, parce qu'on vise un contenu libre et structuré en Markdown (avec titres, listes, blocs code, etc.).

### 3.4 `LessonProgress`

État par utilisateur × leçon.

```prisma
model LessonProgress {
  userId       String
  lessonId     String
  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson       Lesson  @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  completedAt  DateTime @default(now())

  @@id([userId, lessonId])                        // couple unique = clé primaire composite
  @@index([userId])
}
```

**Raisons :**
- Modèle **binaire** (lue / pas lue), pas de « % lu ». Plus simple, suffisant pour la V1.
- `@@id` composite : pas d'id synthétique, lecture O(1) via clé.
- `onDelete: Cascade` : si un apprenant est supprimé (RGPD), sa progression l'est aussi.
- `onDelete: Cascade` côté leçon : si une leçon disparaît du catalogue, les progress orphelins sont nettoyés automatiquement (évite le besoin de reconciliation manuelle).

### 3.5 `ChapterQuest` (table pivot, optionnelle)

Lie un chapitre à une quête gamifiée existante. Purement additive : ne touche pas à `Quest`.

```prisma
model ChapterQuest {
  chapterId String
  questId   String
  chapter   Chapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  quest     Quest   @relation(fields: [questId], references: [id], onDelete: Restrict)
  order     Int                                  // position d'affichage dans le chapitre
  note      String?                              // ex. "À faire après la leçon 2"

  @@id([chapterId, questId])
  @@index([chapterId])
}
```

**Raisons du pivot vs `Quest.chapterId` optionnel :**
- `Quest.chapterId` ajouterait une colonne à la table `Quest` existante → modification de schéma non-additive (ajout de colonne acceptable mais moins pur).
- Une quête peut être référencée par plusieurs chapitres si l'organisation évolue.
- Si on n'utilise pas la fonctionnalité au Sprint 1B, la table `ChapterQuest` reste simplement vide — aucun impact.

### 3.6 Back-refs à ajouter sur modèles existants

**Important** : ces champs sont **purement Prisma** (côté ORM). Ils ne génèrent aucune colonne additionnelle dans SQLite — la FK vit dans les nouvelles tables uniquement.

```prisma
model User {
  // … champs existants intacts …
  lessonProgress LessonProgress[]   // NOUVEAU — back-ref uniquement
}

model Quest {
  // … champs existants intacts …
  chapters ChapterQuest[]           // NOUVEAU — back-ref uniquement
}
```

Vérification : Prisma Studio + `prisma db pull` confirmeront qu'aucune colonne n'est ajoutée à `User` ou `Quest`.

---

## 4. Schéma complet à ajouter (prêt à copier)

Insertion à la fin de `prisma/schema.prisma`, après `UserEvent` (ligne 123).

```prisma
/* =============================================================
 * ACADEMY  — Sprint 1B
 * Parcours pédagogique structuré (Course → Chapter → Lesson),
 * complémentaire du système de quêtes gamifiées.
 * ============================================================= */

model Course {
  id          String    @id @default(cuid())
  slug        String    @unique
  title       String
  subtitle    String
  description String
  coverIcon   String    @default("BookOpen")
  order       Int
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  chapters    Chapter[]
}

model Chapter {
  id       String   @id @default(cuid())
  courseId String
  course   Course   @relation(fields: [courseId], references: [id], onDelete: Restrict)
  slug     String
  title    String
  summary  String
  order    Int

  lessons      Lesson[]
  linkedQuests ChapterQuest[]

  @@unique([courseId, slug])
  @@index([courseId, order])
}

model Lesson {
  id               String    @id @default(cuid())
  chapterId        String
  chapter          Chapter   @relation(fields: [chapterId], references: [id], onDelete: Restrict)
  slug             String
  title            String
  summary          String
  content          String
  estimatedMinutes Int       @default(5)
  order            Int
  publishedAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  progress LessonProgress[]

  @@unique([chapterId, slug])
  @@index([chapterId, order])
}

model LessonProgress {
  userId      String
  lessonId    String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  completedAt DateTime @default(now())

  @@id([userId, lessonId])
  @@index([userId])
}

model ChapterQuest {
  chapterId String
  questId   String
  chapter   Chapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  quest     Quest   @relation(fields: [questId], references: [id], onDelete: Restrict)
  order     Int
  note      String?

  @@id([chapterId, questId])
  @@index([chapterId])
}
```

Modifications **ajoutées** dans les modèles existants (uniquement les back-refs, pas de colonnes) :

```prisma
model User {
  // … (inchangé) …
  lessonProgress LessonProgress[]   // AJOUT
}

model Quest {
  // … (inchangé) …
  chapters ChapterQuest[]           // AJOUT
}
```

---

## 5. Plan de migration — 3 options

**Rappel** : la base `db/custom.db` existe mais n'a **aucune migration Prisma versionnée** (`prisma/migrations/` est absent). Les tables actuelles ont été créées via `prisma db push` au fil du temps.

### Option A — Baseline + migrate dev (la plus propre)

Établit la discipline Prisma Migrate à partir de maintenant, sans toucher aux données existantes.

```bash
# 1. Baseline : marquer le schéma actuel comme "init" déjà appliqué
docker compose -f docker-compose.dev.yml exec -T bitquest-dev npx prisma migrate dev \
  --name init --create-only
docker compose -f docker-compose.dev.yml exec -T bitquest-dev npx prisma migrate resolve \
  --applied $(ls prisma/migrations | head -1)

# 2. Éditer prisma/schema.prisma pour ajouter les 5 nouveaux modèles + 2 back-refs
# 3. Générer et appliquer la migration add_academy
docker compose -f docker-compose.dev.yml exec -T bitquest-dev npx prisma migrate dev \
  --name add_academy
```

**Avantages** :
- Ajoute `prisma/migrations/` versionné (traçable en git).
- `migrate dev` ne drop pas de données tant qu'il n'y a pas de drift.
- Migration ré-exécutable identiquement en CI ou en prod plus tard.

**Inconvénients** :
- Le `migrate dev` a un comportement interactif : si drift détecté, il propose un reset (il faut répondre `No`).
- Le `--create-only` + `migrate resolve` est un pattern ponctuel à documenter.

**Risque** : si une réponse interactive est mal gérée et accepte le reset, perte de données. **Mitigation** : snapshot `db/custom.db` avant toute commande + exécution manuelle (toi au clavier).

### Option B — `prisma db push` SANS `--accept-data-loss`

Plus simple, moins propre.

```bash
# Éditer prisma/schema.prisma (ajouts seuls, aucune suppression)
docker compose -f docker-compose.dev.yml exec -T bitquest-dev npx prisma db push
```

**Avantages** :
- Une seule commande.
- `db push` sans `--accept-data-loss` **refuse** si la migration perdrait des données (colonne/table supprimée, type restreint). Notre changement étant purement additif, il doit passer sans intervention.

**Inconvénients** :
- Pas de fichier de migration versionné.
- Deviendra une dette technique au moment de la migration Postgres.

**Risque** : faible pour ce changement additif. Si le push propose quand même une suppression, on refuse.

### Option C — SQL à la main via sqlite3 CLI

```sql
CREATE TABLE Course ( ... );
CREATE UNIQUE INDEX ... ;
-- ... etc
```

**Avantages** :
- Contrôle total.

**Inconvénients** :
- Divergence entre `schema.prisma` et base réelle (il faudrait aussi éditer le schema et faire un `prisma db pull` pour recadrer).
- Perte de temps par rapport à A ou B.

**À écarter** sauf besoin pointu.

---

## 6. Recommandation

**Option A (baseline + migrate dev)** si tu veux installer la discipline migrations dès maintenant. Je recommande cette option car on va vers Postgres bientôt et autant poser les migrations propres.

**Option B (db push sans --accept-data-loss)** si tu préfères la vitesse et la simplicité à court terme. Zéro risque de perte sur ce changement purement additif.

Je penche légèrement pour **Option A** mais les deux sont acceptables.

---

## 7. Points sécurité à flaguer **avant l'exécution**

1. **Snapshot DB obligatoire** avant toute commande qui touche la base :
   ```bash
   cp db/custom.db "db/custom.db.bak-$(date +%Y%m%d-%H%M%S)"
   ```
2. **Exécution manuelle** des commandes Prisma qui demandent confirmation (migrate dev interactif) — je ne les lancerai pas via `exec -T` qui bypass TTY.
3. **Vérification post-migration** :
   - `shasum -a 256 db/custom.db` (notera le changement légitime).
   - Compter les lignes de chaque table existante → doit être identique.
   - Vérifier l'absence de colonne ajoutée dans `User` et `Quest` (via `.schema User` et `.schema Quest` en sqlite3).
4. **Rollback** : restaurer le snapshot `.bak` si quoi que ce soit dérape.

---

## 8. Tâches qui suivront la validation du schéma

Dans l'ordre, une fois ce plan validé :

1. **Snapshot DB** (ligne 1 ci-dessus).
2. **Appliquer le schéma** (option A ou B selon ton choix).
3. **Vérifier** l'intégrité des tables existantes.
4. **Régénérer le client Prisma** et relancer `typecheck + lint + test` (doit rester vert).
5. **Écrire `prisma/seed.ts`** pour ajouter 1 cours « Fondamentaux Bitcoin » + 2 chapitres × 3 leçons chacun en français. Le lancer **manuellement** (`npx prisma db seed` ou script dédié) — jamais destructif pour les tables existantes.
6. **Créer `src/lib/bitquest/academy.ts`** — fonctions typées de lecture (getCoursesSummary, getCourseTree, getLessonWithProgress, selectNextLessonInCourse) + tests Vitest sur la logique pure.
7. **Routes API** `/api/academy/courses`, `/api/academy/courses/[slug]`, `/api/academy/lessons/[id]/complete`.
8. **Pages SSR** `/academy`, `/academy/[courseSlug]`, `/academy/[courseSlug]/[chapterSlug]/[lessonSlug]`.
9. **Lecteur Markdown** via `react-markdown` (lib déjà présente).
10. **Activer la tuile Académie** du Dashboard (retirer `disabled`, pointer vers `/academy`).
11. **Commit(s)** cohérent(s) par sous-étape.

---

## 9. Décisions à confirmer avant exécution

1. ✅ Schéma proposé (§4) OK ou ajustements ?
2. ✅ Option de migration — **A** ou **B** ? (Je recommande A, mais B est aussi acceptable.)
3. ✅ Garder `ChapterQuest` (pivot Chapitre↔Quête) dans le même sprint, ou le différer à un sprint ultérieur ?
4. ✅ `onDelete` policies confirmées (Cascade pour LessonProgress/ChapterQuest, Restrict pour Course→Chapter et Chapter→Lesson) ?
5. ✅ Autorisation pour le snapshot `.bak` versionné localement (ignoré par git) ?
6. ✅ Je peux exécuter moi-même les commandes dans Docker, ou tu préfères que je te les donne et tu les lances toi-même (TTY interactif au clavier pour migrate dev) ?

---

**Rédigé le** : 2026-11-09
**Statut** : en attente de validation. **Aucune modification de base, de schéma ou de code source tant que tu n'as pas validé ces 6 points.**
