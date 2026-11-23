# BITQUEST ↔ BITLAB — Intégration GandalNexus

> Snapshot opérationnel du protocole 2026-11-14 · LOT 14.
> Pour la vision stratégique, voir `BITQUEST_INTEGRATION_BITLAB.md` (historique).

## 1. Vue d'ensemble du flow

```
BitQuest                                            BitLab
   │                                                   │
   │  1. Clic « Ouvrir dans BitLab » (quête)           │
   │─────────────────────────────────────────────────▶ │
   │  GET /api/bitlab/deep-link?questCode=&kind=…      │
   │                                                   │
   │  2. Deep-link signé (HMAC + v:1) + launch_token   │
   │     JWT HS256 TTL 60s + attemptId CREATED         │
   │                                                   │
   │  3. Redirect top-level vers BitLab                │
   │─────────────────────────────────────────────────▶ │
   │                                                   │
   │                                                   │ 4. parseBitquestMission
   │                                                   │    + exchange launch_token
   │                                                   │    (POST verify-launch-token)
   │  ◀─────────────────────────────────────────────── │
   │  5. BitLab consomme → store user + session        │
   │                                                   │
   │                                                   │ 6. Mission UI, apprenant
   │                                                   │    construit la preuve
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
   │  9. Server :                                      │
   │     - verifyChallengeOrRespond()                  │
   │     - consume nonce (Redis SET NX)                │
   │     - verif on-chain (mempool / LND / format)     │
   │     - attempt PROOF_PENDING → VERIFYING           │
   │       → COMPLETED (ou FAILED)                     │
   │     - upsert BitLabProof                          │
   │     - snapshotAttemptResult (XP+sats+badges)      │
   │                                                   │
   │ 10. Redirect retour signé (verify-return v:1)     │
   │─────────────────────────────────────────────────▶ │
   │                                                   │
   │                                                   │ 11. Banner « Preuve envoyée »
   │                                                   │     window.location → BitQuest
   │  ◀─────────────────────────────────────────────── │
   │                                                   │
   │ 12. UserQuestProgress.status=COMPLETED,           │
   │     flash toast gain XP+sats                      │
   │                                                   │
```

## 2. Artefacts cryptographiques

| Artefact | Secret | Format | TTL | Anti-replay |
|---|---|---|---|---|
| Deep-link HMAC | `BITLAB_SIGN_SECRET` (opt) | base64url sig sur `v\|userId\|questCode\|kind\|network\|ts` | Pas de TTL direct, `ts` lu à l'arrivée | Signature + `attemptId` single-use |
| Launch token JWT | `BITLAB_LAUNCH_SECRET` > `BITLAB_JWT_SECRET` > `CSRF_SECRET` | HS256 { userId, pseudo, role, email, emailVerifiedAt, nonce, v, aud=bitlab-user, iss=bitquest } | 60 s | nonce Redis SET NX EX 600 |
| Session token BitLab | idem | HS256 { userId, pseudo, role, v, aud=bitlab-session } | 2 h | Pas de revocation jusqu'à LOT 14 ; désormais clear via `/api/auth/bitlab-logout` (rotation `User.token`) |
| Challenge mission JWT | `BITLAB_JWT_SECRET` | HS256 { userId, questCode, kind, network, attemptId?, nonce, exp, aud=bitlab, v } | 10 min | nonce Redis SET NX |
| Verify-return URL | `BITLAB_SIGN_SECRET` | HMAC sur `v\|userId\|questCode\|kind\|network\|ts` | — | `ts` echoé par BitLab, ré-vérifié |

## 3. Routes BitQuest exposées à BitLab

| Route | Méthode | Auth | CORS | Rate-limit | Rôle |
|---|---|---|---|---|---|
| `/api/bitlab/deep-link` | POST | cookie session | — | 30/60s user, 120/60s IP | Génère URL signée + attempt |
| `/api/bitlab/deep-link/verify-return` | POST | cookie session | — | 60/60s user, 240/60s IP | Marque mission comme retournée de BitLab |
| `/api/bitlab/challenge` | GET | JWT ou cookie | — | 30/60s user, 120/60s IP | Émet JWT mission |
| `/api/bitlab/proof` | POST | JWT challenge | — | 20/60s user, 80/60s IP | Vérifie preuve, update attempt |
| `/api/auth/launch-token` | POST | cookie session | — | 15/60s user | Émet launch_token (SSO sur demande) |
| `/api/auth/verify-launch-token` | POST | public | allowlist `BITLAB_ALLOWED_ORIGINS` | 60/60s IP | Exchange launch_token → session token |
| `/api/auth/bitlab-sso` | GET | cookie session (silent) | allowlist | 30/60s IP | SSO top-level nav |
| `/api/auth/bitlab-logout` | GET | cookie session | allowlist | 30/60s IP | **Déconnexion globale** (LOT 14) |

## 4. États MissionAttempt

```
CREATED ──▶ IN_PROGRESS ──▶ PROOF_PENDING ──▶ VERIFYING ──▶ COMPLETED
   │              │                │               │             │
   └─── ABANDONED ┴── ABANDONED ────┴── FAILED ─────┴── FAILED ───┘
        (user action)                 (proof invalide)
   └─── EXPIRED ◀──── (toutes les étapes non terminales, TTL 2h)
```

Transition atomique via `updateMany({ where: { id, state: { in: FROM } } })`.
Count == 0 → race perdue, caller voit `ILLEGAL_TRANSITION`.

## 5. Scénarios d'erreur gérés

| Scénario | Réponse | Fichier |
|---|---|---|
| launch_token expiré (>60s) | 400 avec code `JWT_EXPIRED` | `launch-token.ts:verifyLaunchToken` |
| launch_token rejeu (nonce consommé) | 400 "déjà consommé" | `launch-token.ts:148` |
| JWT challenge `v > current` | 400 + audit `INVALID_JWT` | `proof/route.ts:88` |
| mempool.space timeout 5s | `null` renvoyé → 404 côté caller | `mempool.ts:fetchWithTimeout` |
| mempool.space down → fallback blockstream | tryGet retry transparent | `mempool.ts:tryGet` |
| attempt expiré (>2h) | 410 "Tentative expirée" | `proof/route.ts:154` |
| attempt race (count=0) | ILLEGAL_TRANSITION | `attempt.ts:transitionAttempt` |
| CHANNEL sans LND | 501 "indisponible" (ou DECLARATIVE OK) | `proof/route.ts:280` |
| ADDRESS funded_txo_count=0 (USED) | 409 REJECTED | `proof/route.ts` branche ADDRESS |
| rate-limit dépassé | 429 "Trop de requêtes" | tous les routes `/api/bitlab/*` |

## 6. Déconnexion globale (LOT 14)

Nouveau flow pour « quitter proprement GandalNexus » depuis BitLab.

```
BitLab header dropdown                        BitQuest
    │                                              │
    │  « Déconnexion globale »                     │
    │  window.location.assign(                     │
    │    /api/auth/bitlab-logout?returnTo=<url>)   │
    │ ───────────────────────────────────────────▶ │
    │                                              │ Rote User.token
    │                                              │ Set-Cookie bq_session=; MA=0
    │                                              │ Set-Cookie bq_csrf=; MA=0
    │                                              │ 302 vers <returnTo>?logged_out=1
    │ ◀─────────────────────────────────────────── │
    │                                              │
    │  useBitquestMission détecte ?logged_out=1    │
    │  → clearUser() (store vidé)                  │
    │  → router.replace(pathname)                  │
```

Sécurité :
- `returnTo` validé contre `BITLAB_ALLOWED_ORIGINS` (même allowlist que
  `/api/auth/bitlab-sso`).
- Rate-limit IP 30/60s.
- Pas de CSRF (déconnecter n'exfiltre rien).
- Idempotent si pas de session.

## 7. Tests d'intégration

| Fichier | Nb | Couvre |
|---|---:|---|
| `src/app/api/bitlab/flow.e2e.test.ts` | 6+ | Deep-link + challenge + proof + versioning + rate-limit IP |
| `src/app/api/auth/sso-e2e.test.ts` | 4 | bitlab-sso + verify-launch-token chain |
| `src/app/api/auth/bitlab-sso/route.test.ts` | 13 | returnTo allowlist, rate-limit, silent mode |
| `src/app/api/auth/bitlab-logout/route.test.ts` | 8 | Déconnexion globale (LOT 14) |
| `src/lib/auth/launch-token.test.ts` | 10 | émission, verify, anti-replay, downgrade v |

Total **≈ 41 scénarios d'intégration** sur le protocole.

## 8. Dépendances runtime

- **Redis** : anti-replay nonce + rate-limit. Fallback in-memory si
  `REDIS_URL` absent (dev). En prod : indispensable (sinon anti-replay
  silencieusement désactivé avec `log.warn`).
- **mempool.space + blockstream.info** : vérification TX/BLOCK/ADDRESS.
  Fallback explicite. Timeout 5s.
- **LND REST** (opt) : vérification CHANNEL en mode LND. Si absent,
  seul le mode DECLARATIVE est utilisable.

## 9. Limites connues

- **Session token BitLab (2h)** : pas de revocation granulaire côté BitQuest.
  La déconnexion globale fait rotation `User.token` (bloque les requêtes
  ensuite) + clear cookies. Les JWT émis restent cryptographiquement
  valides jusqu'à expiry mais ne matchent plus aucun user côté BitQuest.
- **CHANNEL sur testnet** : pas d'index LN public, nécessite LND opt-in
  ou mode DECLARATIVE.
- **Silent SSO** : cookie `bq_session` est SameSite=Lax → envoyé sur
  navigation top-level, pas sur fetch cross-origin. D'où le passage par
  `?silent=1` qui navigue top-level.
