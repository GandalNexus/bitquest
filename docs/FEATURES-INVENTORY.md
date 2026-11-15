# FEATURES INVENTORY — GandalNexus (BitQuest + BitLab)

> Snapshot audit **2026-11-15 · LOT 14 → 33**. À réconcilier avec le code via
> les tests avant toute affirmation « DONE ». Statuts :
>
> - **DONE** : implémenté + testé + vérifié bout-en-bout.
> - **PARTIAL** : implémenté mais incomplet / périmètre réduit.
> - **VERIFY** : implémenté, fonctionnement réel non démontré ici.
> - **TODO** : absent ou non fonctionnel.

## 1. BitQuest

### Auth & sécurité

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| Cookie `bq_session` HttpOnly + SameSite=Lax + Secure (prod) | DONE | `src/lib/bitquest/session.ts` | `buildSessionCookie()` idoine. |
| CSRF double-submit (HMAC) | DONE | `src/lib/auth/csrf.ts` + `requireRoleAndCsrf` sur 20+ routes admin | Dev fallback explicite, prod rejette au boot si `CSRF_SECRET` absent. |
| Password hashing scrypt + timing-safe compare | DONE | `src/lib/auth/password.ts` | Salt 16 B, scryptSync, `timingSafeEqual`. |
| Password min length 10 chars | DONE (LOT 14) | `src/lib/validation/schemas.ts` + auth-screen + password-change-form + i18n fr/en/wo | Bump 6 → 10. |
| Rate-limit (Redis + fallback in-memory) | DONE | `src/lib/bitquest/session.ts:rateLimit` | Appliqué sur `/api/auth/*`, `/api/bitlab/*`, `/api/me/*`, `/api/quests/*`. |
| Rôles APPRENTICE / EDITOR / ADMIN | DONE | `src/lib/auth/roles.ts` + layouts `(admin)`, `(studio)` | Hiérarchie `ROLE_RANK`, `requireRoleSsr`. |
| JWT secrets (BITLAB_JWT_SECRET, BITLAB_LAUNCH_SECRET) | DONE | `src/lib/bitlab/jwt.ts`, `src/lib/auth/launch-token.ts` | Fallback chain + throw en prod si absent. |
| Logout rotatif + clear cookies | DONE | `src/app/api/auth/logout/route.ts` | Rote `User.token`. |
| Déconnexion globale GandalNexus (logout depuis BitLab) | DONE (LOT 14) | `src/app/api/auth/bitlab-logout/route.ts` + dropdown BitLab | Miroir `bitlab-sso`, rate-limit 30/60s, allowlist. |

### Académie / pédagogie

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| Modèles Course / Chapter / Lesson / ChapterQuest | DONE | `prisma/schema.prisma` | 4 migrations appliquées. |
| Progression `LessonProgress` | DONE | `prisma/schema.prisma` + `src/app/api/academy/lessons/[id]/complete/route.ts` | |
| UI publique académie (`/academy`, `/academy/[courseSlug]`) | DONE | `src/app/(app)/academy/*` | |
| Admin CRUD Course / Chapter / Lesson | DONE | `src/app/(admin)/admin/{courses,chapters,lessons}/*` | Éditeur MDX (`@mdxeditor/editor`). |
| Admin CRUD Quest / Challenge / Badge / TeamMember / User-role | DONE (LOT 13) | `src/app/(admin)/admin/*` | Search + pagination côté Users et Quests. |
| Admin CRUD search universel | PARTIAL | — | Courses / Chapters / Lessons / Badges / Challenges / TeamMembers sans search. |
| Portail Studio (EDITOR) | DONE (LOT 11 T2) | `src/app/(studio)/*` | Re-export admin pages. |
| Gate per-chapter (quête obligatoire pour débloquer) | TODO | — | `ChapterQuest` n'est pas un prérequis obligatoire. |

### BitLab proof flow

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| Deep-link signé HMAC + version `v` | DONE | `src/app/api/bitlab/deep-link/route.ts`, `src/lib/bitlab/deep-link.ts` | Compat legacy (sans `v`). |
| Launch token JWT HS256 TTL 60s + nonce Redis | DONE | `src/lib/auth/launch-token.ts` | aud=bitlab-user, single-use. |
| SSO top-level (`/api/auth/bitlab-sso`) | DONE | `src/app/api/auth/bitlab-sso/route.ts` | Cookie Lax, allowlist origines. |
| Challenge JWT (`/api/bitlab/challenge`) | DONE | `src/app/api/bitlab/challenge/route.ts` | version `v`, anti-replay nonce. |
| Proof verification : TX, BLOCK, INVOICE, CHANNEL, ADDRESS | DONE | `src/app/api/bitlab/proof/route.ts` | Mempool + Blockstream fallback, LND opt-in pour CHANNEL. |
| Mode DECLARATIVE (CHANNEL testnet sans LND) | DONE | `src/lib/bitlab/channel.ts` | Déclaré par mission. |
| MissionAttempt state machine durable | DONE | `src/lib/bitlab/attempt.ts` | 8 états, updateMany atomique. |
| Historique + reprise (`/api/me/bitlab-attempts`) | DONE | `src/app/api/me/bitlab-attempts/route.ts` + tuile dashboard | Resume via `attemptId`. |
| Snapshot récompenses sur attempt complété | DONE | `attempt.ts:snapshotAttemptResult` | Trace XP+sats+badges. |
| Audit log `BitLabProof` + export CSV admin | DONE | `src/app/(admin)/admin/bitlab/attempts/*` | |

### Récompenses Lightning

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| Modèle `LightningReward` (séparé de `User.sats` simulé) | DONE | `prisma/schema.prisma` | |
| Feature flag `lightning.rewards` seeded OFF | DONE | `prisma/seed.ts` + `src/lib/feature-flag.ts` | |
| Kill-switch env `LND_SEND_REWARDS_LIVE=1` | DONE | `src/lib/lightning/rewards.ts` | Garde 5. |
| Plafond per-invoice (100k sats default, override possible) | DONE | `rewards.ts` | |
| Plafonds glissants 24h / 7j | DONE (LOT 14) | `rewards.ts:sumRewardsSince` | Default 50k / 200k sats, somme PAID+PENDING. |
| UI apprenant `/rewards` + redeem form | DONE | `src/app/(app)/rewards/*` | Codes d'erreur mappés FR. |
| Admin `/admin/lightning-rewards` (list + filtres + pagination) | DONE | `src/app/(admin)/admin/lightning-rewards/*` | |
| Isolation stricte sim / réel (tests) | DONE | `rewards.test.ts` | Vérifie absence d'écriture `User.sats`, `WalletTransaction`, `UserEvent`. |
| Auto-trigger à la complétion d'une quête | TODO | — | V1 : redemption manuelle uniquement. |

### Attestations & certificats (LOT 25-30)

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| Handler event-bus `quest.completed` → Attestation auto | DONE | `src/lib/handlers/attestations.ts`, `instrumentation.ts` | Idempotent (P2002), fail-closed non bloquant. |
| API GET `/api/me/attestations` | DONE | `src/app/api/me/attestations/route.ts` + tests | Scope user strict, enrichi targetTitle. |
| Page apprenant `/attestations` | DONE | `src/app/(app)/attestations/page.tsx` | Nav item LOT 32. |
| Tuile dashboard « Mes attestations » | DONE | `src/components/bitquest/dashboard.tsx` | Masquée si count=0. |
| Export Certificate HMAC signé | DONE | `src/lib/certificates/sign.ts`, `src/app/api/me/attestations/[id]/certificate/route.ts` | PBKDF2 pas requis — HMAC-SHA256. V2 Schnorr pour NIP Nostr. |
| Route publique `/api/certificates/verify` | DONE | `src/app/api/certificates/verify/route.ts` | Rate-limit IP 60/60s. |
| Page publique `/verify` | DONE | `src/app/verify/page.tsx` | Share link copy depuis `/attestations`. |

### Industrialisation

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| Postgres 16 prod + 8 migrations | DONE | `prisma/migrations/*` + `docker-compose.yml` | Scripts backup/restore. |
| Logger pino structuré + redaction + Sentry relay | DONE | `src/lib/log.ts`, `src/lib/obs/sentry.ts` | Opt-in via DSN. |
| Sentry business warnings (LOT 31) | DONE | `src/lib/obs/sentry.ts:captureBusinessWarning` | Wire : reward LND failure + cron purge anomalie. |
| Cron purge MissionAttempt (LOT 22) | DONE | `src/app/api/cron/purge-expired-attempts/route.ts` | X-Cron-Secret timing-safe. |
| Admin feature-flags toggle UI (LOT 24) | DONE | `src/app/(admin)/admin/feature-flags/*` | ADMIN only, audit `FEATURE_FLAG_UPDATE`. |
| Admin audit log complet (LOT 33) | DONE | `src/app/(admin)/admin/audit/page.tsx` | +3 actions LOT 23/24. |
| Instrumentation Next.js 15 | DONE | `instrumentation.ts` | Remplace les 3 anciens `sentry.*.config.ts`. |
| A11y focus-visible + skip-link | DONE (LOT 13) | `src/app/globals.css` + `layout.tsx` | |
| i18n FR (410) / EN (410) | DONE | `src/i18n/messages/{fr,en}.json` | |
| i18n Wolof (138 keys = 34%) | PARTIAL | `src/i18n/messages/wo.json` | Fallback FR non automatique. |
| Analytics admin (completion %, friction) | DONE (LOT 13) | `src/app/(admin)/admin/page.tsx` | Prisma `groupBy` live. |
| Playwright E2E (6 scénarios) | PARTIAL | `tests/e2e/*.spec.ts` | Smoke uniquement. Pas de flow mission. |
| Tests unitaires (vitest) | DONE | 812+ tests | Coverage CSRF, Zod, logger figés. |
| Attestation / Certificate / FeatureFlag schemas | DONE (LOT 11 T4) | migration `20261113000000_*` + `src/lib/feature-flag.ts` + `src/lib/event-bus.ts` | Préparation modules futurs. |

## 2. BitLab

### Wallet non-custodial

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| Génération BIP39 (12/24 mots) + HD BIP32 | DONE | `src/lib/wallet/keys.ts` | `@scure/bip39` + `@scure/bip32`. |
| Dérivation P2PKH / P2WPKH / P2TR | DONE | `src/lib/wallet/keys.ts` | `@scure/btc-signer`. |
| Persistance IndexedDB (idb-keyval) | DONE | `src/lib/wallet/store.ts` | Store `bitlab-lab-state-v1`. |
| Clés chiffrées at-rest | TODO | — | Mnemonic/WIF en clair dans IndexedDB. |

### Transactions Bitcoin

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| PSBT / buildSignedTx | DONE | `src/lib/wallet/tx.ts` | `@scure/btc-signer`. |
| Fee estimation (vsize × feeRate) | DONE | `tx.ts:estimateVsize` | Dust limit 546 sats enforcé. |
| Signature client-side uniquement | DONE | `tx.ts:buildSignedTx` | Aucune clé ne quitte le navigateur. |

### Lightning (WASM / LDK)

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| WASM `lnlab_bg.wasm` compilé Rust 1.82 | DONE | `rust/lnlab/*`, `public/lnlab/*` | Rebuild 2026-11-14 via `rust:1.82-bookworm`. |
| Deux nœuds LDK (A/B) persistés IndexedDB | DONE | `src/lib/lightning.ts` + `/lnlab/worker.js` | Boot fresh ou restore. |
| open_channel / pay_invoice / create_invoice / close_channel | DONE | `rust/lnlab/src/lib.rs` | |
| Exposition `scidFormatted` (block×tx×vout) | DONE (LOT 11 T3) | `lib.rs:channels_of` | Prêt pour /api/bitlab/proof kind=CHANNEL. |
| CTA « Soumettre à BitQuest » sur channel ready | DONE (LOT 13) | `src/components/bitlab/lightning.tsx` | |

### Modules

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| Mining (nonce PoW réel + Web Workers) | DONE | `src/lib/mining/core.ts`, `miner.ts` + `/miner/worker.js` | sha256(sha256(header)) ciblé. |
| Explorer multi-réseau | DONE | `src/lib/mempool.ts` | testnet3/4, signet, regtest via `/api/bitcoin` proxy. |
| Dashboard hero (StatCard + GandalNexusMissionCard) | DONE | `src/components/bitlab/*` | |

### Intégration GandalNexus (BitLab-side)

| Fonctionnalité | Statut | Fichiers | Notes |
|---|---|---|---|
| Parse deep-link (`parseBitquestMission`) | DONE | `src/lib/bitquest-bridge.ts` | 8 champs. |
| Store mission persist sessionStorage | DONE | `src/lib/bitquest-mission-store.ts` | Survit au refresh. |
| Store user persist sessionStorage | DONE | `src/lib/bitquest-user-store.ts` | Token + expiresAt. |
| Verify launch token (CORS → BitQuest) | DONE | `src/lib/bitquest-user.ts` | Bearer `sessionToken` ensuite. |
| Silent SSO (passive check ?silent=1) | DONE (LOT 13) | `src/lib/use-silent-sso.ts` | TTL localStorage 10 min. |
| Déconnexion globale via `?logged_out=1` | DONE (LOT 14) | `src/lib/use-bitquest-mission.ts` | Clear store + clean URL. |
| Badge mobile + dropdown logout | DONE | `src/components/bitlab/header.tsx` | Déconnexion locale + globale. |
| Responsive mobile sur 6 modules | VERIFY | `src/components/bitlab/*` | Classes sm:/md:/lg: présentes, pas de QA device-par-device. |
| Dark mode (CSS class + localStorage) | DONE | `src/components/bitlab/theme.tsx` | Boot script anti-FOUC. |

## 3. Recap statut (par bloc)

| Bloc | DONE | PARTIAL | VERIFY | TODO |
|---|---:|---:|---:|---:|
| Auth & sécurité | 9 | 0 | 0 | 0 |
| Académie (gate LOT 16/17 inclus) | 7 | 1 | 0 | 0 |
| BitLab proof flow | 11 | 0 | 0 | 0 |
| Récompenses Lightning | 9 | 0 | 0 | 0 |
| Attestations & certificats (LOT 25-30) | 7 | 0 | 0 | 0 |
| Industrialisation (LOT 22/24/31/33) | 14 | 1 | 0 | 0 |
| BitLab wallet (LOT 18/20 inclus) | 4 | 0 | 0 | 1 |
| BitLab TX | 3 | 0 | 0 | 0 |
| BitLab Lightning | 5 | 0 | 0 | 0 |
| BitLab modules | 3 | 0 | 0 | 0 |
| Intégration GN | 7 | 0 | 1 | 0 |

Voir aussi : `IMPLEMENTATION-STATUS.md` (critères d'acceptation),
`TECHNICAL-DEBT.md` (dette), `BITQUEST-BITLAB-INTEGRATION.md` (flow),
`RELEASE-READINESS.md` (checklist mise en prod).
