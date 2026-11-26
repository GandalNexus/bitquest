# BITQUEST ↔ BITLAB — GandalNexus Integration

> Operational snapshot of the protocol 2026-11-14 · LOT 14.
> For the strategic vision, see `BITQUEST_INTEGRATION_BITLAB.md` (history).

## 1. Flow overview

```
BitQuest                                            BitLab
   │                                                   │
   │  1. Click "Open in BitLab" (quest)                │
   │─────────────────────────────────────────────────▶ │
   │  GET /api/bitlab/deep-link?questCode=&kind=…      │
   │                                                   │
   │  2. Signed deep-link (HMAC + v:1) + launch_token  │
   │     JWT HS256 TTL 60s + attemptId CREATED         │
   │                                                   │
   │  3. Top-level redirect to BitLab                  │
   │─────────────────────────────────────────────────▶ │
   │                                                   │
   │                                                   │ 4. parseBitquestMission
   │                                                   │    + exchange launch_token
   │                                                   │    (POST verify-launch-token)
   │  ◀─────────────────────────────────────────────── │
   │  5. BitLab consumes → store user + session        │
   │                                                   │
   │                                                   │ 6. Mission UI, learner
   │                                                   │    builds the proof
   │                                                   │
   │  7. GET /api/bitlab/challenge?attemptId=…         │
   │  ◀─────────────────────────────────────────────── │
   │  → JWT challenge (nonce, aud=bitlab, v:1)         │
   │     attempt CREATED → IN_PROGRESS                 │
   │                                                   │
   │  8. POST /api/bitlab/proof                        │
   │  ◀─────────────────────────────────────────────── │
   │  { jwt, kind, txid|hash|bolt11|scid|address }     │
   │                                                   │
   │  9. Server:                                       │
   │     - verifyChallengeOrRespond()                  │
   │     - consume nonce (Redis SET NX)                │
   │     - on-chain verif (mempool / LND / format)     │
   │     - attempt PROOF_PENDING → VERIFYING           │
   │       → COMPLETED (or FAILED)                     │
   │     - upsert BitLabProof                          │
   │     - snapshotAttemptResult (XP+sats+badges)      │
   │                                                   │
   │ 10. Signed return redirect (verify-return v:1)    │
   │─────────────────────────────────────────────────▶ │
   │                                                   │
   │                                                   │ 11. Banner "Proof sent"
   │                                                   │     window.location → BitQuest
   │  ◀─────────────────────────────────────────────── │
   │                                                   │
   │ 12. UserQuestProgress.status=COMPLETED,           │
   │     flash toast gain XP+sats                      │
   │                                                   │
```

## 2. Cryptographic artifacts

| Artifact | Secret | Format | TTL | Anti-replay |
|---|---|---|---|---|
| Deep-link HMAC | `BITLAB_SIGN_SECRET` (opt) | base64url sig on `v\|userId\|questCode\|kind\|network\|ts` | No direct TTL, `ts` read on arrival | Signature + single-use `attemptId` |
| Launch token JWT | `BITLAB_LAUNCH_SECRET` > `BITLAB_JWT_SECRET` > `CSRF_SECRET` | HS256 { userId, pseudo, role, email, emailVerifiedAt, nonce, v, aud=bitlab-user, iss=bitquest } | 60 s | nonce Redis SET NX EX 600 |
| BitLab session token | same | HS256 { userId, pseudo, role, v, aud=bitlab-session } | 2 h | No revocation until LOT 14; now cleared via `/api/auth/bitlab-logout` (rotation of `User.token`) |
| Mission challenge JWT | `BITLAB_JWT_SECRET` | HS256 { userId, questCode, kind, network, attemptId?, nonce, exp, aud=bitlab, v } | 10 min | nonce Redis SET NX |
| Verify-return URL | `BITLAB_SIGN_SECRET` | HMAC on `v\|userId\|questCode\|kind\|network\|ts` | — | `ts` echoed by BitLab, re-verified |

## 3. BitQuest routes exposed to BitLab

| Route | Method | Auth | CORS | Rate-limit | Role |
|---|---|---|---|---|---|
| `/api/bitlab/deep-link` | POST | session cookie | — | 30/60s user, 120/60s IP | Generates signed URL + attempt |
| `/api/bitlab/deep-link/verify-return` | POST | session cookie | — | 60/60s user, 240/60s IP | Marks mission as returned from BitLab |
| `/api/bitlab/challenge` | GET | JWT or cookie | — | 30/60s user, 120/60s IP | Issues mission JWT |
| `/api/bitlab/proof` | POST | challenge JWT | — | 20/60s user, 80/60s IP | Verifies proof, updates attempt |
| `/api/auth/launch-token` | POST | session cookie | — | 15/60s user | Issues launch_token (SSO on demand) |
| `/api/auth/verify-launch-token` | POST | public | allowlist `BITLAB_ALLOWED_ORIGINS` | 60/60s IP | Exchange launch_token → session token |
| `/api/auth/bitlab-sso` | GET | session cookie (silent) | allowlist | 30/60s IP | Top-level nav SSO |
| `/api/auth/bitlab-logout` | GET | session cookie | allowlist | 30/60s IP | **Global logout** (LOT 14) |

## 4. MissionAttempt states

```
CREATED ──▶ IN_PROGRESS ──▶ PROOF_PENDING ──▶ VERIFYING ──▶ COMPLETED
   │              │                │               │             │
   └─── ABANDONED ┴── ABANDONED ────┴── FAILED ─────┴── FAILED ───┘
        (user action)                 (invalid proof)
   └─── EXPIRED ◀──── (all non-terminal stages, TTL 2h)
```

Atomic transition via `updateMany({ where: { id, state: { in: FROM } } })`.
Count == 0 → lost race, caller sees `ILLEGAL_TRANSITION`.

## 5. Handled error scenarios

| Scenario | Response | File |
|---|---|---|
| launch_token expired (>60s) | 400 with code `JWT_EXPIRED` | `launch-token.ts:verifyLaunchToken` |
| launch_token replay (consumed nonce) | 400 "already consumed" | `launch-token.ts:148` |
| JWT challenge `v > current` | 400 + audit `INVALID_JWT` | `proof/route.ts:88` |
| mempool.space 5s timeout | `null` returned → 404 on caller side | `mempool.ts:fetchWithTimeout` |
| mempool.space down → blockstream fallback | tryGet transparent retry | `mempool.ts:tryGet` |
| attempt expired (>2h) | 410 "Attempt expired" | `proof/route.ts:154` |
| attempt race (count=0) | ILLEGAL_TRANSITION | `attempt.ts:transitionAttempt` |
| CHANNEL without LND | 501 "unavailable" (or DECLARATIVE OK) | `proof/route.ts:280` |
| ADDRESS funded_txo_count=0 (USED) | 409 REJECTED | `proof/route.ts` ADDRESS branch |
| rate-limit exceeded | 429 "Too many requests" | all `/api/bitlab/*` routes |

## 6. Global logout (LOT 14)

New flow to "cleanly leave GandalNexus" from BitLab.

```
BitLab header dropdown                        BitQuest
    │                                              │
    │  "Global logout"                             │
    │  window.location.assign(                     │
    │    /api/auth/bitlab-logout?returnTo=<url>)   │
    │ ───────────────────────────────────────────▶ │
    │                                              │ Rotate User.token
    │                                              │ Set-Cookie bq_session=; MA=0
    │                                              │ Set-Cookie bq_csrf=; MA=0
    │                                              │ 302 to <returnTo>?logged_out=1
    │ ◀─────────────────────────────────────────── │
    │                                              │
    │  useBitquestMission detects ?logged_out=1    │
    │  → clearUser() (store emptied)               │
    │  → router.replace(pathname)                  │
```

Security:
- `returnTo` validated against `BITLAB_ALLOWED_ORIGINS` (same allowlist as
  `/api/auth/bitlab-sso`).
- IP rate-limit 30/60s.
- No CSRF (logging out doesn't exfiltrate anything).
- Idempotent if no session.

## 7. Integration tests

| File | Count | Covers |
|---|---:|---|
| `src/app/api/bitlab/flow.e2e.test.ts` | 6+ | Deep-link + challenge + proof + versioning + IP rate-limit |
| `src/app/api/auth/sso-e2e.test.ts` | 4 | bitlab-sso + verify-launch-token chain |
| `src/app/api/auth/bitlab-sso/route.test.ts` | 13 | returnTo allowlist, rate-limit, silent mode |
| `src/app/api/auth/bitlab-logout/route.test.ts` | 8 | Global logout (LOT 14) |
| `src/lib/auth/launch-token.test.ts` | 10 | issuance, verify, anti-replay, downgrade v |

Total **≈ 41 integration scenarios** on the protocol.

## 8. Runtime dependencies

- **Redis**: nonce anti-replay + rate-limit. In-memory fallback if
  `REDIS_URL` is absent (dev). In prod: essential (otherwise anti-replay
  silently disabled with `log.warn`).
- **mempool.space + blockstream.info**: TX/BLOCK/ADDRESS verification.
  Explicit fallback. 5s timeout.
- **LND REST** (opt): CHANNEL verification in LND mode. If absent,
  only the DECLARATIVE mode is usable.

## 9. Known limitations

- **BitLab session token (2h)**: no granular revocation on the BitQuest side.
  Global logout rotates `User.token` (blocks subsequent requests)
  + clears cookies. Issued JWTs remain cryptographically
  valid until expiry but no longer match any user on the BitQuest side.
- **CHANNEL on testnet**: no public LN index, requires opt-in LND
  or DECLARATIVE mode.
- **Silent SSO**: `bq_session` cookie is SameSite=Lax → sent on
  top-level navigation, not on cross-origin fetch. Hence the use of
  `?silent=1` which navigates top-level.
