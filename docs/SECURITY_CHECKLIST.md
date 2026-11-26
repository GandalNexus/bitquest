# BitQuest Security Checklist — Phase 5.5

**Date**: 2026-11-10
**Status**: ready for an external pentest (constraints documented below)

This document lists active protections, items verifiable by an
external audit, and known limitations. It complements `SECURITY.md` (public
disclosure policy).

---

## 1. Authentication & Session

| Protection                          | Status | Reference                                       |
|-------------------------------------|--------|-------------------------------------------------|
| `bq_session` HttpOnly cookie        | ready  | `src/lib/bitquest/session.ts` (Phase 1.2a)      |
| SameSite=Lax + Secure (prod)        | ready  | `buildSessionCookie()`                          |
| Token rotation on login/logout/pwd  | ready  | auth route + `/api/me/password` (1.2a + account)|
| Password scrypt + salt 16 B         | ready  | `/api/auth` register                            |
| Password ≥ 10 characters (LOT 14)   | ready  | `src/lib/validation/schemas.ts:21`              |
| `timingSafeEqual` on verify         | ready  | `/api/auth` login + `/api/me/password`          |
| Rate limit 5/min on password change | ready  | `src/app/api/me/password/route.ts`              |
| Rate limit 10/min guest signup/IP   | ready  | `/api/auth` guest branch                        |
| **MFA / 2FA**                       | no     | Out of scope v1 — product decision              |
| **Password reset (forgot pwd)**     | no     | To add in email verification phase              |

---

## 2. CSRF

| Protection                                   | Status | Reference                               |
|----------------------------------------------|--------|-----------------------------------------|
| Double-submit pattern (cookie + header)      | ready  | `src/lib/auth/csrf.ts` (Phase 1.2b)     |
| Stateless HMAC-SHA256 (derived from session tok) | ready | `computeCsrfToken()`                   |
| `timingSafeEqual` on verify                  | ready  | `verifyCsrfToken()`                     |
| Enforced on all cookie-auth mutations        | ready  | `requireCsrf()` in guards               |
| Exempt for legacy auth header (immune)       | ready  | `isCookieAuthenticated()` gate          |
| Rotation on logout + password change         | ready  | Set-Cookie clear or new CSRF            |
| Secret validation (`CSRF_SECRET` required prod) | ready | `getCsrfSecret()` throws in prod       |
| Coverage frozen by test (P1.3)               | ready  | `src/lib/auth/csrf-coverage.test.ts` — explicit allowlist, fails if a POST/PUT/DELETE route is added without CSRF |

**`SameSite=Lax` decision (rationale)**: `Strict` would break inbound
navigation from external links (notably verification emails that
point to `/verify-email?token=…`). `Lax` allows top-level GET method
from a third-party domain but blocks cross-site POST requests (where the CSRF
double-submit takes over). Keep `Lax`.

---

## 3. Authorization & Roles

| Protection                                   | Status | Reference                               |
|----------------------------------------------|--------|-----------------------------------------|
| Roles APPRENTICE / EDITOR / ADMIN            | ready  | `src/lib/auth/roles.ts` (Phase 1.1)     |
| `hasAtLeastRole` default lock-down           | ready  | Unknown values → APPRENTICE             |
| `requireRole` on admin routes                | ready  | `src/lib/auth/guard.ts`                 |
| `requireRoleSsr` on admin Server Components  | ready  | `src/lib/auth/server.ts`                |
| Self-lockout protection (last admin)         | ready  | `/api/admin/users/[id]/role`            |
| Audit log of every admin mutation            | ready  | `AdminAuditLog` + 23 tracked actions    |

---

## 4. Input Validation

| Protection                            | Status | Reference                               |
|---------------------------------------|--------|-----------------------------------------|
| Zod at all POST API boundaries        | ready  | `src/lib/validation/schemas.ts` (1.3)   |
| Typed discriminated unions            | ready  | auth, quest-progress, quiz questions    |
| Business bounds (xp/sats/level)       | ready  | Prevents attacks via extreme values     |
| 400 rejection with `issues[]`         | ready  | `parseJsonBody()` returns Zod details   |
| JSON parsing error → 400              | ready  | Instead of crash                        |

---

## 5. Rate Limiting

| Protection                            | Status | Reference                               |
|---------------------------------------|--------|-----------------------------------------|
| Redis-backed (prod multi-instance)    | ready  | `src/lib/cache/redis.ts` (Phase 1.4)    |
| In-memory fallback (dev)              | ready  | `rateLimitInMemory()`                   |
| Resilience: Redis down → fallback     | ready  | Try/catch INCR / EXPIRE                 |
| Keys: per IP (anonymous), per user (auth) | ready | guest:IP, progress:userId, etc.        |

---

## 6. Observability

| Capability                            | Status | Reference                               |
|---------------------------------------|--------|-----------------------------------------|
| `/api/health` public (LB probes)      | ready  | `src/app/api/health/route.ts` (5.1a)    |
| DB + Redis checks                     | ready  | `src/lib/health.ts` (5.1c)              |
| Structured logs (pino)                | ready  | `src/lib/log.ts` (5.1b)                 |
| Redaction (token, password, headers)  | ready  | `REDACT_PATHS`                          |
| Sentry wiring (no-op if no DSN)       | ready  | `src/lib/obs/sentry.ts`                 |
| `beforeSend` scrub email + IP         | ready  | `sentry.server.config.ts`               |
| Live `/admin/health` admin page       | ready  | ADMIN only                              |

---

## 7. GDPR / Privacy

| Protection                            | Status | Reference                               |
|---------------------------------------|--------|-----------------------------------------|
| Soft-delete `User.deletedAt`          | ready  | PII anonymization (email null, pseudo)  |
| Password confirmation + DELETE chain  | ready  | `/api/me/delete`                        |
| Admin hard-delete (permanent purge)   | ready  | `/api/admin/users/[id]/purge`           |
| No cleartext user-provided logs       | ready  | pino `redact` + Sentry `beforeSend`     |
| Strictly necessary cookies            | ready  | `bq_session`, `bq_csrf`, `bq_locale`    |

---

## 8. Dependencies & Build

| Check                                 | Status | Reference                               |
|---------------------------------------|--------|-----------------------------------------|
| CI lint + typecheck + unit + E2E      | ready  | `.github/workflows/ci.yml`              |
| Playwright E2E on auth + admin gate   | ready  | `tests/e2e/`                            |
| Axe-core a11y audit (WCAG 2.1 AA)     | ready  | `tests/e2e/a11y.spec.ts`                |
| `npm audit` (to automate)             | partial | Manual for now                         |
| `depcheck` (orphan deps)              | partial | Manual                                  |

---

## 9. External Pentest Checklist

Before commissioning an external team (Phase 5.5), ensure that:

1. **Dedicated test env** (not prod) with a fixed `CSRF_SECRET` provided to the pentester.
2. **Dedicated accounts**: 1 ADMIN, 1 EDITOR, 1 APPRENTICE, 1 guest account (see
   `scripts/ci-test-users.js`).
3. **Fresh database**: `prisma migrate deploy && tsx prisma/seed.ts`.
4. **Exposed surface** to audit:
   - `/api/auth` (register / login / guest)
   - `/api/me/*` (password, delete, GET)
   - `/api/admin/**` (role, courses, chapters, lessons, quests/*/{theory,quiz,mission}, badges, challenges, users/[id]/purge)
   - `/api/challenges/*`
   - `/api/academy/**`
   - `/api/quests/*/progress`
   - SSR routes `/admin/**` (role gate)
   - SPA UI `/`, `/academy/**`, `/dashboard`, `/profile`
5. **Expected attacks (response benchmark)**:
   - **CSRF**: POST without `X-CSRF-Token` cookie-auth → 403 (double-submit)
   - **SQL injection**: Prisma with prepared params — but check $queryRaw
   - **XSS**: react-markdown on lesson content — check sanitization
   - **IDOR**: `/api/admin/users/[id]/role` by APPRENTICE → 403
   - **Privilege escalation**: self-demote ADMIN → 400 (last admin check)
   - **Session fixation**: token rotated on login / logout / password change
   - **Replay**: CSRF tokens rotated with session, never valid twice
   - **Rate limit bypass**: attempt `x-forwarded-for` header spoofing
6. **No real Lightning requirement in v1**: sats are pedagogical,
   no server-side private key, no on-chain payout.

---

## 10. Known Limitations (to document in the pentest report)

- **No 2FA**: v1 deliberately. Mitigated by token rotation + rate limit.
- **No email verification**: accounts register without verification. Mitigated
  by effect limitation (pedagogical XP/sats, no real payout).
- **No self-service password reset**: an admin can regenerate the `token`
  via Prisma Studio, but no user-facing flow. Planned post-v1.
- **SQLite `JSON.parse` on `theorySections` / `missionConfig`**: stored
  as String, parsed on each read. Native Postgres Json planned in Phase 0.5.
- **Stateless HMAC CSRF**: if `CSRF_SECRET` leaks, all CSRF tokens
  become forgeable. Mitigated by secret rotation = global invalidation.
- **Client-side logout doesn't force closure across all tabs**:
  the cookie is cleared + token rotated, but a request already in flight could
  pass before the next roundtrip. Low risk.

---

**Recommended next actions**:

1. Add `npm audit --production` as a separate CI job (non-blocking at first).
2. Automate Snyk or Socket.dev scans.
3. Run Playwright E2E with "promoted admin" context to cover the
   CRUDs (currently: account creation + ad-hoc tests).
4. Paid external pentest if the project goes into public production.
