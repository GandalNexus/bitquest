# Checklist sécurité BitQuest — Phase 5.5

**Date** : 2026-11-10
**Statut** : prêt pour un pentest externe (contraintes documentées ci-dessous)

Ce document liste les protections actives, les éléments vérifiables par un
audit externe, et les limitations connues. Il complète `SECURITY.md` (policy
publique de divulgation).

---

## 1. Authentification & session

| Protection                          | Statut | Référence                                       |
|-------------------------------------|--------|-------------------------------------------------|
| Cookie `bq_session` HttpOnly        | ✅     | `src/lib/bitquest/session.ts` (Phase 1.2a)      |
| SameSite=Lax + Secure (prod)         | ✅     | `buildSessionCookie()`                          |
| Token rotation sur login/logout/pwd | ✅     | auth route + `/api/me/password` (1.2a + account)|
| Mot de passe scrypt + salt 16 B      | ✅     | `/api/auth` register                            |
| `timingSafeEqual` sur verify         | ✅     | `/api/auth` login + `/api/me/password`          |
| Rate limit 5/min sur password change | ✅     | `src/app/api/me/password/route.ts`              |
| Rate limit 10/min guest signup/IP    | ✅     | `/api/auth` guest branch                        |
| **MFA / 2FA**                        | ❌     | Hors scope v1 — décision produit                |
| **Password reset (forgot pwd)**      | ❌     | À ajouter en Phase email verification           |

---

## 2. CSRF

| Protection                                   | Statut | Référence                               |
|----------------------------------------------|--------|-----------------------------------------|
| Double-submit pattern (cookie + header)      | ✅     | `src/lib/auth/csrf.ts` (Phase 1.2b)     |
| HMAC-SHA256 stateless (dérivé du session tok) | ✅     | `computeCsrfToken()`                    |
| `timingSafeEqual` sur verify                 | ✅     | `verifyCsrfToken()`                     |
| Enforcé sur toutes les mutations cookie-auth | ✅     | `requireCsrf()` dans guards             |
| Exempt pour auth header legacy (immune)      | ✅     | `isCookieAuthenticated()` gate          |
| Rotation sur logout + password change        | ✅     | Set-Cookie clear ou nouveau CSRF        |
| Secret validation (`CSRF_SECRET` requis prod) | ✅     | `getCsrfSecret()` throw en prod         |

---

## 3. Autorisation & rôles

| Protection                                   | Statut | Référence                               |
|----------------------------------------------|--------|-----------------------------------------|
| Roles APPRENTICE / EDITOR / ADMIN            | ✅     | `src/lib/auth/roles.ts` (Phase 1.1)     |
| `hasAtLeastRole` lock-down par défaut        | ✅     | Valeurs inconnues → APPRENTICE          |
| `requireRole` sur routes admin               | ✅     | `src/lib/auth/guard.ts`                 |
| `requireRoleSsr` sur Server Components admin | ✅     | `src/lib/auth/server.ts`                |
| Self-lockout protection (dernier admin)      | ✅     | `/api/admin/users/[id]/role`            |
| Audit log de chaque mutation admin           | ✅     | `AdminAuditLog` + 23 actions tracées    |

---

## 4. Validation des entrées

| Protection                            | Statut | Référence                               |
|---------------------------------------|--------|-----------------------------------------|
| Zod à toutes les frontières API POST  | ✅     | `src/lib/validation/schemas.ts` (1.3)   |
| Discriminated unions typées           | ✅     | auth, quest-progress, quiz questions    |
| Bornes métier (xp/sats/level)         | ✅     | Évite les attaques via valeurs extrêmes |
| Rejet 400 avec `issues[]`             | ✅     | `parseJsonBody()` retourne détails Zod  |
| JSON parsing error → 400              | ✅     | Au lieu de crash                        |

---

## 5. Rate limiting

| Protection                            | Statut | Référence                               |
|---------------------------------------|--------|-----------------------------------------|
| Redis-backed (prod multi-instance)    | ✅     | `src/lib/cache/redis.ts` (Phase 1.4)    |
| Fallback in-memory (dev)              | ✅     | `rateLimitInMemory()`                   |
| Résilience : Redis down → fallback    | ✅     | Try/catch INCR / EXPIRE                 |
| Clés : par IP (anonyme), par user (auth) | ✅  | guest:IP, progress:userId, etc.         |

---

## 6. Observabilité

| Capacité                              | Statut | Référence                               |
|---------------------------------------|--------|-----------------------------------------|
| `/api/health` public (LB probes)      | ✅     | `src/app/api/health/route.ts` (5.1a)    |
| DB + Redis checks                     | ✅     | `src/lib/health.ts` (5.1c)              |
| Logs structurés (pino)                | ✅     | `src/lib/log.ts` (5.1b)                 |
| Redaction (token, password, headers)  | ✅     | `REDACT_PATHS`                          |
| Sentry wiring (no-op si pas de DSN)   | ✅     | `src/lib/obs/sentry.ts`                 |
| `beforeSend` scrub email + IP         | ✅     | `sentry.server.config.ts`               |
| Admin page `/admin/health` live       | ✅     | ADMIN only                              |

---

## 7. RGPD / vie privée

| Protection                            | Statut | Référence                               |
|---------------------------------------|--------|-----------------------------------------|
| Soft-delete `User.deletedAt`          | ✅     | Anonymisation PII (email null, pseudo)  |
| Confirmation password + chaîne DELETE | ✅     | `/api/me/delete`                        |
| Hard-delete admin (purge définitive)  | ✅     | `/api/admin/users/[id]/purge`           |
| Pas de logs user-fournis en clair     | ✅     | pino `redact` + Sentry `beforeSend`     |
| Cookies strictement nécessaires       | ✅     | `bq_session`, `bq_csrf`, `bq_locale`    |

---

## 8. Dépendances & build

| Vérification                          | Statut | Référence                               |
|---------------------------------------|--------|-----------------------------------------|
| CI lint + typecheck + unit + E2E      | ✅     | `.github/workflows/ci.yml`              |
| Playwright E2E sur auth + admin gate  | ✅     | `tests/e2e/`                            |
| Axe-core a11y audit (WCAG 2.1 AA)     | ✅     | `tests/e2e/a11y.spec.ts`                |
| `npm audit` (à automatiser)           | ⚠️     | Manuel pour l'instant                   |
| `depcheck` (deps orphelines)          | ⚠️     | Manuel                                  |

---

## 9. Checklist pentest externe

Avant de missionner une équipe externe (Phase 5.5), s'assurer que :

1. **Env de test dédié** (pas la prod) avec `CSRF_SECRET` fixe fourni au pentester.
2. **Comptes dédiés** : 1 ADMIN, 1 EDITOR, 1 APPRENTICE, 1 compte guest (voir
   `scripts/ci-test-users.js`).
3. **Base de données neuve** : `prisma migrate deploy && tsx prisma/seed.ts`.
4. **Surface exposée** à auditer :
   - `/api/auth` (register / login / guest)
   - `/api/me/*` (password, delete, GET)
   - `/api/admin/**` (role, courses, chapters, lessons, quests/*/{theory,quiz,mission}, badges, challenges, users/[id]/purge)
   - `/api/challenges/*`
   - `/api/academy/**`
   - `/api/quests/*/progress`
   - Routes SSR `/admin/**` (gate role)
   - UI SPA `/`, `/academy/**`, `/dashboard`, `/profile`
5. **Attaques attendues (benchmark réponses)** :
   - **CSRF** : POST sans `X-CSRF-Token` cookie-auth → 403 (double-submit)
   - **SQL injection** : Prisma avec params prépare — mais vérifier $queryRaw
   - **XSS** : react-markdown sur contenus leçons — vérifier sanitization
   - **IDOR** : `/api/admin/users/[id]/role` par APPRENTICE → 403
   - **Privilege escalation** : self-demote ADMIN → 400 (dernier admin check)
   - **Session fixation** : token roté sur login / logout / password change
   - **Replay** : CSRF token rotés avec session, jamais deux fois valides
   - **Rate limit bypass** : tenter header spoofing `x-forwarded-for`
6. **Pas d'obligation Lightning réelle en v1** : les sats sont pédagogiques,
   pas de clé privée serveur, pas de payout on-chain.

---

## 10. Limitations connues (à documenter dans le rapport pentest)

- **Pas de 2FA** : v1 délibérément. Mitigé par rotation token + rate limit.
- **Pas d'email verification** : les comptes s'enregistrent sans vérif. Mitigé
  par limitation des effets (XP/sats pédagogiques, pas de payout réel).
- **Pas de password reset self-service** : un admin peut regénérer le `token`
  via Prisma Studio, mais pas de flow user-facing. Prévu phase post-v1.
- **SQLite `JSON.parse` sur `theorySections` / `missionConfig`** : stockés
  en String, parsés à chaque lecture. Postgres Json natif prévu en Phase 0.5.
- **CSRF stateless HMAC** : si `CSRF_SECRET` fuit, tous les tokens CSRF
  deviennent forgeables. Mitigé par rotation du secret = invalidation globale.
- **Logout côté client ne force pas la fermeture dans tous les onglets** :
  le cookie est clear + token roté, mais une requête déjà en vol pourrait
  passer avant le prochain roundtrip. Risque faible.

---

**Prochaines actions recommandées** :

1. Ajouter `npm audit --production` en job CI séparé (non-bloquant au début).
2. Automatiser les scans Snyk ou Socket.dev.
3. Tourner Playwright E2E avec le contexte "admin promu" pour couvrir les
   CRUDs (actuellement : création compte + tests ponctuels).
4. Pentest externe rémunéré si projet rentre en production publique.
