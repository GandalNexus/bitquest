# IMPLEMENTATION STATUS — GandalNexus

> Statut d'implémentation **par critère d'acceptation** (vs. le prompt
> « Mission audit / finalisation »). Mise à jour 2026-11-14 · LOT 14.
>
> Structure : Plateforme · Module · Statut · Fichiers · Tests · Problèmes ·
> Action restante · Critère d'acceptation.

## P0 — Sécurité, intégrité, fiabilité

### BitQuest · Auth sessions & JWT

- **Statut** : DONE
- **Fichiers** : `src/lib/bitquest/session.ts`, `src/lib/auth/csrf.ts`,
  `src/lib/auth/launch-token.ts`, `src/lib/bitlab/jwt.ts`
- **Tests** : `csrf.test.ts`, `session.cookies.test.ts`,
  `launch-token.test.ts`, `jwt.test.ts`, `flow.e2e.test.ts`
- **Problèmes** : aucun.
- **Critère d'acceptation** : cookie HttpOnly+Lax+Secure(prod), CSRF
  HMAC double-submit sur toutes les routes mutation, JWT versionné
  (v: 1), nonce anti-replay Redis. **Atteint.**

### BitQuest · Rate limiting

- **Statut** : DONE
- **Fichiers** : `src/lib/bitquest/session.ts:rateLimit`,
  `src/lib/cache/redis.ts`
- **Tests** : `flow.e2e.test.ts:rate-limit IP`
- **Critère** : fenêtre glissante Redis + fallback in-memory, buckets
  par userId **et** IP sur `/api/bitlab/*`. **Atteint.**

### BitQuest · Password min length ≥ 10

- **Statut** : DONE (LOT 14)
- **Fichiers** : `src/lib/validation/schemas.ts:21,468`,
  `src/components/bitquest/auth-screen.tsx:90,306`,
  `src/components/bitquest/password-change-form.tsx:36`, i18n fr/en/wo
- **Tests** : `schemas.test.ts:changePasswordSchema` (ajusté)
- **Critère** : refus Zod si pw < 10 chars, label i18n cohérent.
  **Atteint.**

### BitQuest · Lightning rewards — plafonds 24h / 7j

- **Statut** : DONE (LOT 14)
- **Fichiers** : `src/lib/lightning/rewards.ts:sumRewardsSince`,
  `src/app/(app)/rewards/redeem-form.tsx` (codes UI)
- **Tests** : `rewards.test.ts` (+2 cas : daily cap, weekly cap)
- **Problèmes résolus** : un bug ou un attaquant déclenchant sendReward
  en boucle était borné uniquement par le plafond par invoice. Désormais
  la somme PAID+PENDING sur fenêtre glissante borne la casse.
- **Critère** : `INVOICE_OVER_DAILY_CAP` renvoyé si `sum(24h) + amount
  > maxDailyMsat` (default 50k sats). Idem `INVOICE_OVER_WEEKLY_CAP`
  (200k sats / 7j). **Atteint.**

### BitQuest · Mempool timeout

- **Statut** : DONE (déjà en place)
- **Fichiers** : `src/lib/bitlab/mempool.ts:fetchWithTimeout`
- **Critère** : `AbortController` 5s sur toutes les requêtes mempool
  (getTransaction, getBlock, getAddressStats). **Atteint.**

### BitQuest · MissionAttempt idempotence

- **Statut** : DONE (LOT 1)
- **Fichiers** : `src/lib/bitlab/attempt.ts`, `src/lib/bitlab/consume.ts`
- **Tests** : `consume.test.ts`, `attempt.test.ts`, `flow.e2e.test.ts`
- **Critère** : updateMany conditionnel sur (id, state) ; proof
  doublement-soumise retourne 200 idempotent sans re-crédit XP+sats.
  **Atteint.**

## P1 — Complétion fonctionnelle & intégration

### Intégration BitQuest ↔ BitLab — flow complet

- **Statut** : DONE
- **Étapes** (toutes vérifiées) :
  1. Deep-link signé HMAC `v: 1` → `bitquest/src/app/api/bitlab/deep-link/route.ts`
  2. Launch token JWT TTL 60s → `src/lib/auth/launch-token.ts`
  3. BitLab consume `/api/auth/verify-launch-token` → `bitlab/src/lib/bitquest-user.ts`
  4. Mission context parse → `bitlab/src/lib/bitquest-bridge.ts`
  5. Preuve submit → `bitquest/src/app/api/bitlab/proof/route.ts`
  6. Attempt state machine → `src/lib/bitlab/attempt.ts`
  7. Return deep-link signé → `bitquest/src/app/api/bitlab/deep-link/verify-return/route.ts`
  8. Snapshot récompenses → `attempt.ts:snapshotAttemptResult`
- **Tests** : `flow.e2e.test.ts` (6 scénarios), `sso-e2e.test.ts` (4 scénarios)
- **Critère** : flow ininterrompu depuis la quête BitQuest jusqu'à la
  mise à jour de progression et le flash récompense. **Atteint.**

### Intégration · Déconnexion globale GandalNexus

- **Statut** : DONE (LOT 14)
- **Fichiers** : `bitquest/src/app/api/auth/bitlab-logout/route.ts`,
  `bitlab/src/components/bitlab/header.tsx` (item dropdown),
  `bitlab/src/lib/use-bitquest-mission.ts` (branche `?logged_out=1`)
- **Tests** : `bitlab-logout/route.test.ts` (8 scénarios : returnTo,
  session, rate-limit, idempotence)
- **Problème résolu** : BitLab logout était purement local. Désormais
  un clic « Déconnexion globale » navigue top-level vers BitQuest qui
  rote le user.token + clear cookies, puis renvoie à BitLab avec
  `?logged_out=1` → clear store local.
- **Critère** : une fois le flow terminé, l'utilisateur n'est plus
  authentifié ni côté BitQuest (cookie clear, token roté) ni côté
  BitLab (store sessionStorage vidé). **Atteint.**

### BitLab · Wallet & Lightning

- **Statut** : DONE sauf chiffrement at-rest des clés
- **Fichiers** : voir `FEATURES-INVENTORY.md` section BitLab
- **Problèmes** : clés (mnemonic/WIF) stockées en clair dans IndexedDB.
  Déjà noté dans `TECHNICAL-DEBT.md`.
- **Critère** : non-custodial complet (clés jamais hors navigateur),
  fonctionnalité PSBT/TX/LN atteinte. **Atteint sauf chiffrement.**

### BitQuest · Académie complète

- **Statut** : DONE (CRUD) · PARTIAL (gate quête)
- **Fichiers** : `src/app/(admin)/admin/{courses,chapters,lessons}/*`,
  `src/app/(studio)/*`, `src/app/(app)/academy/*`
- **Critère** : CRUD A→Z sur courses/chapters/lessons/quests côté
  admin + studio. Les lessons sont MDX. ChapterQuest n'est pas un
  prérequis obligatoire. **Partiellement atteint** (voir
  `TECHNICAL-DEBT.md` pour le gate manquant).

## P2 — UX, responsive, design system, traductions

### i18n

- **Statut** : DONE FR/EN · PARTIAL WO
- **Fichiers** : `src/i18n/messages/{fr,en,wo}.json`
- **Critère** : FR 410 clés (ref), EN 410 clés, WO 138 clés (34%).
  **Partiellement atteint** — Wolof à compléter pour admin + rewards.

### Responsive mobile BitLab

- **Statut** : VERIFY
- **Fichiers** : `bitlab/src/components/bitlab/*`
- **Critère** : les 6 modules (wallet, tx-builder, lightning, mining,
  explorer, dashboard) utilisables à 375px. **Non validé sur device**
  (classes sm:/md:/lg: présentes mais pas de QA formelle).

### Dark/light mode

- **Statut** : DONE
- **Fichiers** : `bitlab/src/components/bitlab/theme.tsx` +
  `bitquest/src/app/layout.tsx` (next-themes ThemeProvider dans
  `providers.tsx`)
- **Critère** : les 2 modes rendus sans couleurs hardcodées cassant
  le contraste. **Atteint.**

## P3 — Marketplace, certifications, analytics, Nostr

- **Statut** : SCHEMAS DONE · UI TODO
- **Fichiers** : migration `20261113000000_add_feature_flag_attestation_certificate`,
  `src/lib/feature-flag.ts`, `src/lib/event-bus.ts`
- **Critère** : modèles Prisma Attestation + Certificate posés
  (additifs), bus d'événements interne pour brancher analytics / Nostr
  plus tard. UI, marketplace, flow Nostr intentionnellement non livrés
  en v1. **Partiellement préparé.**

## Métriques globales

- Tests vitest : 824 (dont LOT 14 : +2 rewards caps, +8 bitlab-logout)
- Coverage CSRF / Zod / logger : **gel par test** (anti-régression)
- Typecheck BitQuest + BitLab : exit 0
- Lint BitQuest + BitLab : exit 0
- Migrations Postgres appliquées : 8 (toutes additives)
- WASM BitLab rebuild : 2026-11-14 `rust:1.82-bookworm`
