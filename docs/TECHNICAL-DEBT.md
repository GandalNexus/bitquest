# TECHNICAL DEBT — GandalNexus

> État de la dette technique au 2026-11-14 · LOT 14.
> Classement : **blocker** · **important** · **mineur** · **acceptable**.

## 1. Blocker (P0 — à traiter avant mise en prod sérieuse)

Aucun blocker non-adressé au 2026-11-14. Les gaps P0 identifiés lors de
l'audit ont été refermés par le LOT 14 :

- ~~Password min length 6~~ → bumped à 10.
- ~~Lightning rewards sans plafond glissant~~ → caps 24h/7j ajoutés.
- ~~Mempool sans timeout~~ → déjà en place (audit erroné).
- ~~Déconnexion globale BitLab → BitQuest absente~~ → route
  `/api/auth/bitlab-logout` + branche `?logged_out=1` livrées.

## 2. Important (P1 — à traiter avant release publique)

### BitLab · Chiffrement at-rest des clés

- **Problème** : `bitlab/src/lib/wallet/store.ts` stocke mnemonic + WIF
  en clair dans IndexedDB. Un attaquant qui prend le contrôle du
  navigateur (XSS, BitLocker off, malware) extrait toutes les clés.
- **Impact** : v1 testnet/signet uniquement (pas de fonds réels).
  **Blocker si l'on veut un jour passer du signet/testnet au mainnet.**
- **Action** : dériver une clé de chiffrement depuis une passphrase
  utilisateur (PBKDF2/scrypt), chiffrer les champs sensibles avec
  AES-GCM, stocker le ciphertext. Prompt passphrase au boot ou
  à l'utilisation. Alternative : WebAuthn + CryptoKey non-exportable.

### ~~BitQuest · ChapterQuest gate non enforcé~~ → **résolu LOT 16**

- Helper pur `computeChapterLock()` + enrichissement `getCourseTree`
  avec `locked` + `prerequisites` + UI badge Lock.
- Sémantique : anonymes preview, authentifiés = gate pédagogique.
- Reste : seeder des entrées `ChapterQuest` pour activer la feature
  (la table est vide en dev actuel).

### ~~BitQuest · Auto-trigger Lightning reward à la complétion quête~~ → **résolu LOT 15**

- CTA « Réclamer en sats réels ⚡ » sur `RewardsStep` quand
  `sats.granted > 0` → navigation vers `/rewards?from=<questCode>`.
- Bannière contextuelle côté `/rewards` avec regex strict anti-injection
  (`parseQuestCodeHint`).
- Décision conservatrice : pas d'auto-génération d'invoice côté serveur
  — l'utilisateur colle toujours son propre BOLT11 (non custodial).

### BitQuest · Wolof incomplet (138/410 = 34%)

- **Problème** : clés manquantes sur admin, rewards, analytics.
- **Impact** : utilisateurs wolof voient des clés brutes (`auth.dashboard.sats.label`).
- **Action** : traduire les ~272 clés restantes. Fallback FR dans
  `useT()` serait un palliatif acceptable si cadré ops.

## 3. Mineur (P2 — si temps disponible)

### Search manquant sur plusieurs CRUD admin

- **Problème** : Courses, Chapters, Lessons, Badges, Challenges,
  TeamMembers n'ont pas de recherche serveur-side. Au-delà de ~50
  entrées, l'admin devient inutilisable.
- **Action** : copier le pattern `/admin/users` (ILIKE + pagination 25).

### Mobile responsive BitLab (6 modules)

- **Problème** : classes `sm:/md:/lg:` sont présentes mais pas de QA
  device-par-device. Tab bar mobile de `page.tsx` est vraisemblablement
  étroite.
- **Action** : QA manuelle 375px (iPhone SE), 390px (iPhone 12+), 768px
  (iPad). Fixer ce qui déborde.

### E2E Playwright minimal (6 scénarios smoke)

- **Problème** : pas de couverture flow mission complète, pas de CRUD
  admin, pas de redemption reward.
- **Action** : au moins 3 scénarios de parcours :
  1. Register → quest complete → gain XP visible dashboard.
  2. Admin crée un cours → publish → visible sur `/academy`.
  3. Deep-link → BitLab → proof mock → retour → quest completed.

### `BITLAB_SIGN_SECRET` : usage ambigu

- **Problème** : référencé dans la doc ; grep ne trouve aucune
  utilisation dans `src/`. `BITLAB_JWT_SECRET` et `BITLAB_LAUNCH_SECRET`
  font tout le travail.
- **Action** : soit vraiment utiliser (HMAC deep-link via secret dédié),
  soit supprimer de la doc + `.env.example`.

## 4. Acceptable (ne pas corriger sans raison métier)

### `db/custom.db` SQLite vestige

- Fichier non lu par l'application (Prisma pointe sur Postgres depuis
  longtemps). Peut être supprimé mais aucune urgence. Noté dans
  `POSTGRES_PROD.md`.

### Rôles `APPRENTICE | EDITOR | ADMIN` vs. doc historique `LEARNER | AUTHOR | ADMIN`

- La doc produit historique mentionnait `LEARNER / AUTHOR`. Le code
  utilise `APPRENTICE / EDITOR`. Sémantique identique, pas de dette
  réelle — juste harmoniser la prose quand on touche aux docs
  produit.

### Legacy fallback deep-link sans `v`

- Les URLs émises avant LOT P0.3 (sans champ `v`) continuent de
  vérifier correctement via fallback. Elles disparaissent dans la
  fenêtre TTL. Ne pas retirer le fallback avant une fenêtre de grâce
  documentée.

### Session token BitLab 2h sans revocation granulaire

- La rotation `User.token` (déconnexion globale) coupe tous les tokens
  en pratique (BitQuest-side requests échouent), mais les JWT restent
  valides jusqu'à expiry. Acceptable pour v1 — si un jour on veut une
  revocation granulaire, utiliser `jti` + liste Redis.

## 5. Dette de documentation

- **Rôles historiques** (point 4) : harmoniser quand l'occasion se
  présente.
- ~~`SECURITY_CHECKLIST.md` mentionne encore « mot de passe 6+ chars »~~
  → résolu LOT 19 (ligne « ≥ 10 caractères (LOT 14) » ajoutée).
- ~~`BITQUEST_AUDIT.md` liste « mot de passe 6+ chars (trop faible) »~~
  → résolu LOT 19 (prose mise à jour « ≥ 10 chars (bumped LOT 14) »).

## 6. Dépendances externes critiques

| Dépendance | Statut | Fallback | Action |
|---|---|---|---|
| Postgres 16 | Prod ready | — | Surveiller vacuum, backup cron |
| Redis | Prod ready | In-memory (dev only) | Monitor disponibilité |
| mempool.space | Externe public | blockstream.info | Rien à faire, double fallback OK |
| LND REST | Opt-in | mode DECLARATIVE | Documenté, pas obligatoire |
| Sentry | Opt-in via DSN | log local | Décision ops à acter |

## 7. Mise à jour automatique

Ce fichier est append-only pour les dettes résolues (biffer, ne pas
supprimer). Les nouvelles dettes s'ajoutent à la section idoine. Un
lot qui ferme une dette met à jour la ligne en préfixe `~~…~~` + lien
vers le commit.
