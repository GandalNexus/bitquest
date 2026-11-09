# Matrice fonctionnelle BitQuest — 2026-11-09

> Écart entre l'**existant audité** (`BITQUEST_AUDIT.md`) et l'**architecture cible** (`BITQUEST_ARCHITECTURE.md`). Pour chaque fonctionnalité, on précise ce qui est présent, partiel, cosmétique ou absent, ainsi que l'effort estimé pour atteindre la cible.

**Légende de l'état actuel :**
- 🟢 **Opérationnel** — codé, testé manuellement, utilisable
- 🟡 **Incomplet** — codé partiellement, bugs ou cas manquants
- 🔵 **UI seulement** — interface présente mais pas de logique métier derrière
- ⚪ **Absent** — rien n'existe
- 🔴 **Défectueux** — présent mais cassé ou dangereux

**Légende de l'effort :**
- `S` : < 1 jour-dev
- `M` : 1–3 jours
- `L` : 4–10 jours
- `XL` : > 10 jours

---

## A. Gestion des comptes utilisateurs

| Fonctionnalité | État | Preuve (fichier:ligne) | Cible | Effort |
|---|---|---|---|---|
| Inscription email/password | 🟢 | `src/app/api/auth/route.ts:40-70` | Durcir : Zod, politique mdp (8+ chars, zxcvbn ≥ 2) | S |
| Connexion email/password | 🟢 | `src/app/api/auth/route.ts:72-95` | Idem + lockout après N échecs | S |
| Connexion invité | 🟢 | `src/app/api/auth/route.ts:97-110` | Conserver, ajouter conversion → compte permanent | M |
| Connexion Nostr (NIP-07) | ⚪ | — | NextAuth v5 + provider custom | L |
| Connexion wallet / NIP-98 | ⚪ | — | Phase 2+ | L |
| Hachage password | 🟢 | `scryptSync` (`src/app/api/auth/route.ts:16-24`) | Conserver | — |
| Session (transport) | 🔴 | `localStorage` + headers custom | Cookie `httpOnly; Secure; SameSite=Lax` + CSRF | M |
| Middleware route protection | 🔴 | `middleware.ts` cherche un cookie jamais posé | Réécrire sur cookie session réel | S |
| Profil (lecture) | 🟢 | `src/app/api/me/route.ts` | Enrichir (courses in progress, prochaines étapes) | S |
| Profil (édition) | 🟡 | `src/components/bitquest/profile-view.tsx` existe, pas d'endpoint PATCH | Ajouter `PATCH /api/me` | S |
| Préférence langue | ⚪ | — | Champ `User.preferredLocale` + endpoint | S |
| Historique activités | 🟢 | `UserEvent` + dashboard timeline | Enrichir (filtres par type) | S |
| Déconnexion | 🟡 | Clear localStorage côté client | Endpoint `/api/auth/logout` qui invalide le cookie | S |
| Suppression de compte (RGPD) | ⚪ | — | Soft delete + purge événementielle | M |
| 2FA/MFA | ⚪ | — | Phase 2+ | L |
| Rate limit login/signup | 🟡 | Mémoire, non persistant | Redis | M |

**Totaux section A** : ~7 jours.

---

## B. Académie Bitcoin (parcours pédagogiques)

| Fonctionnalité | État | Preuve | Cible | Effort |
|---|---|---|---|---|
| Modèle Course | ⚪ | Absent de `prisma/schema.prisma` | Créer modèle + migration | S |
| Modèle Chapter | ⚪ | — | Créer modèle + migration | S |
| Modèle Lesson | ⚪ | — | Créer modèle MDX + migration | M |
| Contenu multimédia (images/schémas/vidéos) | ⚪ | Seul du texte dans `seed-data.ts` | Modèle `LessonAsset` + upload S3/R2 | M |
| Progression par leçon | ⚪ | — | Modèle `LessonProgress` | S |
| Prérequis pédagogiques transversaux | ⚪ | Juste "quête précédente" (`src/lib/bitquest/quests.ts:40-60`) | Ajouter dépendances inter-chapitres | M |
| Lecteur de leçon | ⚪ | — | Page SSR `/academy/[course]/[chapter]/[lesson]` + MDX renderer | L |
| Indicateur de progression dans un cours | ⚪ | — | Barre de progression / cours | S |
| Catalogue de cours | ⚪ | — | Page `/academy` avec filtres | M |
| Certification de fin de parcours | ⚪ | — | Modèle `Certificate` + rendu PDF | L |

**Totaux section B** : ~18 jours.

---

## C. Quêtes et missions

| Fonctionnalité | État | Preuve | Cible | Effort |
|---|---|---|---|---|
| Modèle Quest | 🟢 | `prisma/schema.prisma:31-49` | Ajouter `chapterId`, `estimatedMinutes`, `publishedAt` | S |
| Quest map (côté user) | 🟢 | `src/components/bitquest/quest-map.tsx` | URL partageable `/quests` | S |
| Quest player 4 étapes | 🟢 | `src/components/bitquest/quest-player.tsx` | Page SSR `/quests/[code]` | M |
| Déverrouillage par niveau + ordre | 🟢 | `src/lib/bitquest/quests.ts:40-70` | Conserver | — |
| 8 types de missions simulées | 🟢 | `src/lib/bitquest/missions.ts` (568 lignes) | Conserver | — |
| Mission BitLab (preuve réelle) | ⚪ | Aucun code | Nouveau `missionKind: BITLAB_PROOF` + verifier | L |
| Validation côté serveur | 🟢 | `src/app/api/quests/[code]/progress/route.ts` | Conserver | — |
| Idempotence des récompenses | 🟡 | Par flag `completedAt`/`missionProof` | Ajouter clé d'idempotence explicite | S |
| Tentatives limitées | 🟢 | `MISSION_MAX_ATTEMPTS` dans `progression.ts` | Conserver | — |
| Historique des preuves | 🟡 | Stocké dans `UserQuestProgress.missionProof` | Modèle dédié `BitLabProof` | S |
| Quêtes quotidiennes | ⚪ | — | Modèle `DailyChallenge` + cron | M |
| Quêtes hebdomadaires | ⚪ | — | Modèle `WeeklyChallenge` | M |
| Quêtes événementielles (SPECIAL) | 🟡 | Track existe, 0 contenu | Peupler via admin | M |
| Quêtes communautaires | ⚪ | — | Phase 2+ | L |

**Totaux section C** : ~15 jours.

---

## D. Quiz et évaluations

| Fonctionnalité | État | Preuve | Cible | Effort |
|---|---|---|---|---|
| Questions MCQ | 🟢 | `prisma/schema.prisma:51-63` | Conserver | — |
| Questions vrai/faux | 🟢 | Idem | Conserver | — |
| Questions à réponses multiples | ⚪ | Non supporté | Ajouter type `MULTI` (bitmap de réponses) | M |
| Questions à validation logique Bitcoin | ⚪ | Non supporté | Ajouter type `LOGIC` (expression → attendu) | L |
| Correction côté serveur | 🟢 | `src/app/api/quests/[code]/progress/route.ts:109-162` | Conserver | — |
| Explications pédagogiques | 🟢 | Retournées par question | Conserver | — |
| Seuil de réussite | 🟢 | 70 % via `QUIZ_PASS_THRESHOLD` | Paramétrable par quête | S |
| Banque de questions / randomisation | ⚪ | Questions fixes par quête | Modèle QuestionBank, tirage N parmi M | M |
| Historique des tentatives | 🟢 | `quizAttempts`, `quizBestScore` | Conserver | — |
| Champ orphelin `QuizQuestion.quest2` | 🔴 | `prisma/schema.prisma:62` | Supprimer | S |

**Totaux section D** : ~5 jours.

---

## E. Gamification

| Fonctionnalité | État | Preuve | Cible | Effort |
|---|---|---|---|---|
| XP et sources | 🟢 | `XP_RULES` dans `progression.ts` | Conserver | — |
| 10 niveaux | 🟢 | `src/lib/bitquest/progression.ts` | Conserver, rendre config | S |
| Badges (15 en seed) | 🟢 | `src/lib/seed-data.ts` | Conserver + ajouter via admin | S |
| Évaluation automatique des badges | 🟢 | `evaluateBadges` | Conserver | — |
| 7 types de conditions | 🟢 | `prisma/schema.prisma:93-94` | Conserver | — |
| Streaks quotidiens | 🟢 | `User.streak` + `lastActiveDate` | Conserver | — |
| Bonus streak sur sats | 🟢 | `awardSats` 0–50 % | Conserver | — |
| Classements (leaderboard) | 🟢 | `src/app/api/leaderboard/route.ts` | Ajouter filtres (hebdo, mensuel, piste) | S |
| Classements amis / privés | ⚪ | — | Phase 2+ | M |
| Succès (achievements au-delà des badges) | ⚪ | — | Optionnel | — |
| Défis quotidiens | ⚪ | — | Section C | — |
| Historique récompenses | 🟢 | `WalletTransaction` + timeline | Conserver | — |

**Totaux section E** : ~3 jours.

---

## F. Récompenses Bitcoin / Lightning

| Fonctionnalité | État | Preuve | Cible | Effort |
|---|---|---|---|---|
| Sats en compteur pédagogique | 🟢 | `User.sats` | Conserver pour phase 1 | — |
| Plafond journalier (10 000 sats) | 🟢 | `SATS_DAILY_CAP` | Conserver + paramétrable | S |
| Wallet pédagogique | 🟡 | Juste un solde, pas un vrai wallet | Vue "wallet symbolique" + onboarding | S |
| Intégration WebLN | ⚪ | — | Phase 3 | L |
| Nœud Lightning serveur (LDK ou LND) | ⚪ | — | Phase 3 (décision archi) | XL |
| Récompense Lightning testnet | ⚪ | — | Phase 3 derrière feature flag | XL |
| Service `LightningRewardService` | ⚪ | — | Phase 3 | L |
| Vérification de preuve `txid` | ⚪ | — | Phase 2 (mission BitLab) | M |
| Vérification de preuve `bolt11` | ⚪ | — | Phase 2 | M |
| Protection double récompense | 🟡 | Flag `missionProof` | Clé d'idempotence + persistance Redis | S |
| Rate limit récompenses (par IP + par user) | 🟡 | 100 req/min via mémoire | Redis + plafonds spécifiques | M |
| Audit / log des récompenses | 🟡 | `WalletTransaction` + `UserEvent` | Modèle `RewardIdempotencyKey` | S |

**Totaux section F** (phase 2 seulement) : ~5 jours.
**Totaux section F** (phase 3 Lightning réelle) : ~30 jours.

---

## G. Administration

| Fonctionnalité | État | Preuve | Cible | Effort |
|---|---|---|---|---|
| Route `/admin` | ⚪ | — | Créer | S |
| Rôles (`APPRENTICE`, `EDITOR`, `ADMIN`) | ⚪ | `User.role` absent | Ajouter champ + enum | S |
| Guard de rôle | ⚪ | — | Helper `requireRole` | S |
| CRUD cours | ⚪ | — | Section B | S |
| CRUD chapitres | ⚪ | — | Section B + DnD | M |
| CRUD leçons (MDX) | ⚪ | — | Avec éditeur `@mdxeditor/editor` | L |
| CRUD quêtes | ⚪ | — | Builder avec preview | L |
| CRUD quiz | ⚪ | — | Builder par type | M |
| CRUD badges | ⚪ | — | — | M |
| Gestion utilisateurs | ⚪ | — | Lecture + changement rôle + soft delete | M |
| Dashboard stats globales | ⚪ | — | DAU, quêtes complétées, sats distribués | M |
| Audit log | ⚪ | — | Modèle + page de consultation | M |
| Modération | ⚪ | — | Phase 2+ | L |
| Export CSV | ⚪ | — | — | S |
| Gestion défis quotidiens / hebdos | ⚪ | — | Calendrier | M |

**Totaux section G** : ~20 jours.

---

## H. UI/UX

| Fonctionnalité | État | Preuve | Cible | Effort |
|---|---|---|---|---|
| Dashboard utilisateur | 🟢 | `src/components/bitquest/dashboard.tsx` | Conserver + améliorer prochaines étapes | S |
| Navigation globale | 🟡 | SPA interne via Zustand | Vraies routes + sidebar accessible | M |
| Cartes de cours | ⚪ | — | Section B | — |
| Parcours visuel (quest map) | 🟢 | `quest-map.tsx` | SSR + deep-link | S |
| Quiz interactif | 🟢 | `quest-player.tsx` | Conserver | — |
| Mission UI (8 types) | 🟢 | `mission-panel.tsx` | Conserver | — |
| Animations de progression | 🟢 | Framer Motion | Conserver | — |
| Animations récompenses | 🟡 | Confettis basiques | Enrichir (level up, badge unlock) | S |
| Dashboard admin | ⚪ | — | Section G | — |
| Dark mode | 🟢 | `next-themes` | Conserver | — |
| Light mode polish | 🟡 | Fonctionnel mais contrastes à vérifier | Audit visuel | S |
| Responsive mobile-first | 🟡 | Hook `use-mobile.ts`, inégal | Audit complet | M |
| Accessibilité (a11y) | ⚪ | Non évaluée | Audit WCAG AA + tests `jest-axe` | M |
| Page 404 / erreur / offline | ⚪ | — | `not-found.tsx`, `error.tsx` | S |
| Composants shadcn orphelins | 🟡 | 36/48 non utilisés | Nettoyer | S |
| Faible consommation de données (Afrique) | ⚪ | Pas de budget perf fixé | Lazy load images, skeletons, service worker optionnel | M |

**Totaux section H** : ~10 jours.

---

## I. Internationalisation

| Fonctionnalité | État | Preuve | Cible | Effort |
|---|---|---|---|---|
| next-intl configuré | ⚪ | Dépendance installée, 0 import | Setup complet | M |
| Locales FR / EN | ⚪ | — | 2 dictionnaires complets | L |
| Locale WO | ⚪ | — | Progressif | L |
| Sélecteur de langue | ⚪ | — | Dans shell | S |
| Contenu quêtes multilingue | ⚪ | FR seulement | Champs `title_fr`/`title_en`/`title_wo` sur `Quest`, `Lesson` | M |
| Dates/nombres localisés | ⚪ | `date-fns/locale fr` seulement | `Intl.DateTimeFormat` via next-intl | S |

**Totaux section I** : ~8 jours (FR+EN), +L pour WO.

---

## J. Intégration BitLab

| Fonctionnalité | État | Preuve | Cible | Effort |
|---|---|---|---|---|
| Deep-link vers BitLab | ⚪ | — | `src/components/bitquest/mission-panel.tsx` : bouton "Ouvrir dans BitLab" | S |
| Transmission contexte mission | ⚪ | — | JWT challenge | M |
| Réception preuve BitLab | ⚪ | — | Endpoint `POST /api/bitlab/proof` | M |
| Vérification txid via mempool.space | ⚪ | — | Service `MempoolClient` | M |
| Vérification BOLT11 | ⚪ | — | Lib `bolt11` + validation | M |
| Vérification BOLT12 | ⚪ | — | Plus complexe, phase 3 | L |
| Journalisation preuves | ⚪ | — | Modèle `BitLabProof` | S |
| Replay protection | ⚪ | — | Challenge JWT à usage unique | S |
| SSO BitQuest ↔ BitLab | ⚪ | — | Phase 2 : juste userId dans JWT | S |

**Totaux section J** : ~10 jours.

---

## K. Qualité, tests, DevOps, sécurité

| Fonctionnalité | État | Preuve | Cible | Effort |
|---|---|---|---|---|
| Lint oxlint + eslint | 🟢 | `oxlint.json`, `eslint.config.mjs` | Conserver | — |
| Prettier | 🟢 | `prettier.config.mjs` | Conserver | — |
| TS strict effectif | 🔴 | `next.config.ts:7` : `ignoreBuildErrors: true` | Retirer, corriger les erreurs | M |
| Vitest | 🔴 | Config pointée sur chemins inexistants | Corriger config, écrire tests | S |
| Tests unitaires `progression.ts` | ⚪ | — | Couvrir XP, niveaux, streak, awardSats | M |
| Tests unitaires `missions.ts` | ⚪ | — | Couvrir les 8 types | M |
| Tests d'intégration routes API | ⚪ | — | Vitest + supertest-like | M |
| Tests E2E | ⚪ | — | Playwright sur parcours de quête | L |
| Tests a11y | ⚪ | — | `@axe-core/playwright` | S |
| CI GitHub Actions | ❓ | `.github/` présent, non inspecté | Confirmer / créer workflow lint + typecheck + test + build | S |
| Pre-commit hooks | ⚪ | — | `lefthook` ou `husky` + `lint-staged` | S |
| Migration SQLite → Postgres | ⚪ | — | Prisma migrate init + conversion | M |
| Migrations versionnées | ⚪ | Pas de `prisma/migrations/` | Activer | S |
| Zod sur toutes les frontières | ⚪ | Zod installé, 0 usage | Schémas par route | M |
| Rate limiting Redis | ⚪ | Mémoire | Upstash/local Redis | M |
| Sentry / monitoring erreurs | ⚪ | — | Sentry self-hosted ou cloud | S |
| Logs structurés | ⚪ | `console.log` ponctuels | `pino` | S |
| Health check `/api/health` | ⚪ | — | Simple ping DB | S |
| Secrets / env docs | 🟡 | `.env.example` minimaliste | Enrichir | S |
| `next.config.ts` : `ignoreBuildErrors` | 🔴 | ligne 7 | Retirer | — |
| Nommage `package.json.name` | 🔴 | `nextjs_tailwind_shadcn_ts` | Renommer `bitquest` | S |
| Suppression `z-ai-web-dev-sdk` | 🔴 | Dépendance orpheline | Retirer | S |
| Nettoyage deps inutilisées | 🟡 | next-auth, next-intl, @mdxeditor, @dnd-kit, 36 shadcn/ui | Audit `depcheck` + suppression | S |
| Suppression `db/custom.db` du suivi | 🟡 | Local, ignoré par .gitignore mais présent | Nettoyer physiquement | S |
| Bug bounty activé | ⚪ | SECURITY.md existe | Annoncer | S |

**Totaux section K** : ~15 jours.

---

## Synthèse globale par phase

| Phase | Portée | Effort estimé |
|---|---|---|
| **Phase 0 — Hygiène** | Nettoyage deps, renommage package, retrait `ignoreBuildErrors`, suppression `z-ai-web-dev-sdk`, config vitest corrigée, index Prisma, migration SQLite → Postgres | ~5 j |
| **Phase 1 — Sécurité & robustesse** | Cookie httpOnly + CSRF, Zod partout, rate limit Redis, rôles + guard, tests unitaires sur domain | ~10 j |
| **Phase 2 — Académie & admin** | Modèles Course/Chapter/Lesson, éditeur MDX, CRUD admin complet, i18n FR+EN, défis quotidiens | ~35 j |
| **Phase 3 — Intégration BitLab** | Deep-link + JWT, vérification txid/BOLT11 via mempool.space, mission `BITLAB_PROOF` | ~10 j |
| **Phase 4 — Récompenses Lightning** | Lightning testnet, `LightningRewardService`, feature flag, audits sécurité | ~30 j |
| **Phase 5 — Industrialisation** | E2E, a11y, monitoring, pentest, bug bounty actif, locale WO | ~15 j |
| **Total** | | **~105 j-dev** |

> Ces estimations supposent un développeur full-stack senior solo. En binôme, compter 60–70 j calendaires.

---

**Rédigé le** : 2026-11-09
**Prochain livrable** : `BITQUEST_INTEGRATION_BITLAB.md`
