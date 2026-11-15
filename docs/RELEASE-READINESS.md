# RELEASE READINESS — GandalNexus v1

> Checklist de mise en production. État **2026-11-15 · LOT 14 → 69**.
> Statuts : ✅ prêt · ⚠️ partiel · ❌ bloquant · ➖ hors scope v1.

## 1. Sécurité

| Item | Statut | Commentaire |
|---|---|---|
| Cookie session HttpOnly + Lax + Secure | ✅ | Secure actif si NODE_ENV=production. |
| CSRF HMAC double-submit | ✅ | 26/29 routes mutation (3 exemptes documentées). |
| Password hashing scrypt + salt 16B + timing-safe | ✅ | |
| Password min length ≥ 10 chars | ✅ | LOT 14. |
| Rate-limit (Redis + fallback) | ✅ | userId + IP sur routes BitLab, user-only ailleurs. |
| JWT secrets validés au boot (prod) | ✅ | Throw si manquant en NODE_ENV=production. |
| Anti-replay nonce (Redis SET NX) | ✅ | Launch token + challenge + verify-return. |
| Lightning rewards : plafonds glissants 24h/7j | ✅ | LOT 14, défense contre boucles sendReward. |
| Kill-switch `LND_SEND_REWARDS_LIVE=1` | ✅ | OFF par défaut, ops opt-in explicite. |
| CORS allowlist pour routes publiques BitLab-facing | ✅ | `BITLAB_ALLOWED_ORIGINS` strict en prod. |
| Déconnexion globale | ✅ | LOT 14. |
| Logger pino + redaction secrets | ✅ | |

## 2. Fiabilité

| Item | Statut | Commentaire |
|---|---|---|
| Timeout 5s sur appels mempool / blockstream | ✅ | `AbortController`. |
| Fallback mempool → blockstream | ✅ | tryGet transparent. |
| Postgres backup automatisé | ⚠️ | Scripts `scripts/backup-postgres.sh` prêts ; cron à configurer en prod. |
| Postgres restore testé | ✅ | `scripts/restore-postgres.sh` + doc dans `POSTGRES_PROD.md`. |
| MissionAttempt idempotence (double-submit) | ✅ | `updateMany` conditionnel atomique. |
| MissionAttempt expiration 2h | ✅ | Transition EXPIRED idempotente. |
| Redis anti-replay disponible | ⚠️ | Si Redis down → `log.warn` + désactivé. Monitorer. |

## 3. Qualité

| Item | Statut | Commentaire |
|---|---|---|
| Tests vitest | ✅ | **888/888 verts** (BitQuest) + 154/154 (BitLab). |
| Typecheck tsc | ✅ | Exit 0 des deux côtés. |
| ESLint | ✅ | Exit 0 BitQuest, 1 warning connu BitLab (cross-origin logout). |
| Coverage CSRF / Zod / logger (gel) | ✅ | Tests de propriété. |
| E2E Playwright | ⚠️ | 8 scénarios (6 smoke + quest-flow + admin-search). Pas de flow mission COMPLETED. |

## 4. Observabilité

| Item | Statut | Commentaire |
|---|---|---|
| Logger structuré pino | ✅ | Scopes catégorisés (bitlab-proof, lightning-rewards, audit, …). |
| Sentry opt-in via DSN | ✅ | Guide ops `SENTRY_OPS.md`. |
| Sentry business warnings (LOT 31) | ✅ | Wire reward LND failure + cron purge > 100. |
| Dashboards Sentry configurés | ➖ | Décision ops à prendre ; guide fourni (alerte >10 err/min). |
| Health endpoint | ✅ | `/api/health` + `/admin/health`. |
| Analytics admin (completion %, friction) | ✅ | Queries live Prisma. |
| Alerting admin ops 24h (LOT 16) | ✅ | BitLab proof outcomes + Lightning rewards sur `/admin`. |
| Admin audit log 29 actions (LOT 33) | ✅ | Filtres par kind, inclut ChapterQuest + FeatureFlag. |

## 5. Documentation

| Doc | Statut | Rôle |
|---|---|---|
| `FEATURES-INVENTORY.md` | ✅ (LOT 14) | Inventaire fonctionnalités. |
| `IMPLEMENTATION-STATUS.md` | ✅ (LOT 14) | Critères d'acceptation par bloc. |
| `BITQUEST-BITLAB-INTEGRATION.md` | ✅ (LOT 14) | Protocole + états + erreurs. |
| `TECHNICAL-DEBT.md` | ✅ (LOT 14) | Dette classée. |
| `RELEASE-READINESS.md` | ✅ (LOT 14) | Ce document. |
| `BITQUEST_ARCHITECTURE.md` | ✅ | Historique. |
| `BITQUEST_ROADMAP.md` | ✅ | Phases 0-5. |
| `SECURITY_CHECKLIST.md` | ✅ (LOT 19) | ≥ 10 chars + ligne dédiée. |
| `POSTGRES_PROD.md` | ✅ | Procédure backup/restore. |
| `SENTRY_OPS.md` | ✅ | Activation Sentry + RGPD. |
| `DOCKER_DEVELOPMENT.md` | ✅ | Dev avec compose. |
| `DOCKER_LND.md` | ✅ | LND testnet opt-in. |
| `I18N_WOLOF.md` | ✅ | Guide i18n Wolof. |
| `PHASE_3_BITLAB.md` | ✅ | État Phase 3 historique. |
| `OPS_RUNBOOK.md` | ✅ (LOT 78) | Secrets, cron, dashboards, incidents. |
| `public/openapi.yaml` | ✅ (LOT 79) | OpenAPI 3.1 des 4 routes publiques (verify, version, nostr.json, health). |
| `public/manifest.webmanifest` | ✅ (LOT 80) | PWA installable (standalone, theme Bitcoin, 3 shortcuts). |
| `src/app/sitemap.ts` + `robots.ts` | ✅ (LOT 81) | SEO : sitemap dynamique (academy slugs) + robots filtrant admin/me/wallet. |

## 6. Blockers hors-scope v1

- ⚠️ Chiffrement at-rest des clés BitLab : **backup opt-in livré
  (LOT 18/20)**, migration complète IndexedDB plaintext → ciphertext
  reste à faire pour passer mainnet. V1 testnet-only acceptable.
- ✅ Certification vérifiable : socle livré (LOT 25-30) — Attestation
  auto + Certificate HMAC + route publique verify + page /verify.
  V2 Schnorr-secp256k1 pour NIP/Nostr cross-origin offline reste à
  faire si on veut l'interop Nostr native.

## 7. Variables d'environnement requises en prod

```bash
# Database
DATABASE_URL=postgres://user:pwd@host:5432/bitquest

# Redis (indispensable)
REDIS_URL=redis://host:6379

# Secrets (32 bytes min, rotation rituelle documentée)
CSRF_SECRET=<32+ random bytes>
BITLAB_JWT_SECRET=<32+ random bytes>
BITLAB_LAUNCH_SECRET=<32+ random bytes> # optionnel, fallback sur BITLAB_JWT_SECRET
BITLAB_SIGN_SECRET=<32+ random bytes>   # optionnel, HMAC deep-link

# SSO
BITLAB_ALLOWED_ORIGINS=https://bitlab.example.com

# Observabilité (opt-in)
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.1

# Lightning rewards (OFF par défaut)
LND_REST_URL=https://lnd:8080
LND_MACAROON_HEX=<hex>
LND_SEND_REWARDS_LIVE=0  # 1 pour activer les paiements réels

# Cron ops (LOT 22)
CRON_SECRET=<32+ random bytes>  # X-Cron-Secret pour /api/cron/*

# Certificates (LOT 28)
CERT_SIGN_SECRET=<32+ random bytes>  # optionnel, fallback sur CSRF_SECRET
NEXT_PUBLIC_BITQUEST_HOST=bitquest.example.com  # pour le champ `issuer`

# Node
NODE_ENV=production
```

## 7bis. Endpoints d'auto-découverte publics (LOT 44)

Les intégrations tierces (BitLab, portfolio Nostr future, relay NIP-11)
peuvent pinger ces endpoints lecture seule sans auth :

| Endpoint | Rôle | LOT |
|---|---|---|
| `GET /api/version` | `{ protocolVersion, certificateVersion, release, commitHash, issuer, builtAt }` | 44 |
| `GET /api/health` | DB + Redis status | 5.1a |
| `GET /api/certificates/verify?blob=<signed>` | Vérifie un Certificate HMAC | 29 |
| `GET /verify` | Page HTML vérification pour un humain | 30 |

**Headers transversaux** (LOT 42/43) sur les réponses JSON :
- `X-Protocol-Version: 1`
- `X-Certificate-Version: 1`

Client pattern :
```ts
const { protocolVersion } = await fetch(`${issuer}/api/version`).then((r) => r.json());
if (protocolVersion > 1) throw new Error("Downgrade required");
```

## 8bis. Smoke test routes (LOT 40, +LOT 44)

Script `scripts/smoke-routes.sh` vérifie en ~5s les 21 routes exposées
(public + API + auth-required + admin) : codes de réponse attendus.

```bash
BASE=http://localhost:3000 ./scripts/smoke-routes.sh
# ou contre staging :
BASE=https://staging.bitquest.example.com ./scripts/smoke-routes.sh
```

Sortie : `PASS: 21  FAIL: 0` si tout est vert (anonymous + no-auth
paths uniquement — pour les scenarios authentifiés, Playwright
E2E).

## 8. Checklist jour-J

- [ ] Backup Postgres pre-release testé.
- [ ] Rotation des secrets validée (nouveau set appliqué, ancien archivé 7 j).
- [ ] `docker compose up -d` ou pipeline CI/CD appliqué.
- [ ] `npx prisma migrate deploy` exécuté.
- [ ] Smoke test HTTP sur 29 pages (app + admin + studio) → 200.
- [ ] Health endpoint 200.
- [ ] CSP / HSTS / rate-limit NGINX configurés.
- [ ] DNS `bitquest.example.com` + `bitlab.example.com`.
- [ ] Monitoring Redis + Postgres (RAM, disk, connection count).
- [ ] Vérifier `BITLAB_ALLOWED_ORIGINS` contient l'URL de prod BitLab.
- [ ] Vérifier `LND_SEND_REWARDS_LIVE=0` (reste OFF jusqu'à audit externe).
- [ ] Log d'ouverture de prod dans le journal ops.

## 9. Rollback

- `docker compose down && docker compose up -d` sur l'image précédente.
- Postgres : `scripts/restore-postgres.sh <dump>.gz` (durée ~ 2-3 min
  sur < 1M rows).
- BitLab : image statique Vercel-like, rollback via tag git ou
  précédente artefact.
