# Certificates v1 — Format and verification

> Specification of the Certificate v1 format issued by BitQuest
> instances. Document for third-party integrators (portfolios, relays,
> HR platforms, other learners).
>
> **Version**: 1 · HMAC-SHA256. V2 will move to Schnorr-secp256k1 to
> enable offline verification (NIP-11 Nostr).

## 1. What is a BitQuest Certificate?

A Certificate is the **exportable, signed** trace of an Attestation.
An Attestation is itself the **immutable server-side** trace of a
Bitcoin quest completed by a learner.

- **Attestation**: DB row on the BitQuest side, created via the event-bus
  as soon as `UserQuestProgress.status = COMPLETED`. Unique on
  `(userId, kind, targetCode)`.
- **Certificate**: blob signed by the BitQuest instance, downloadable
  by the learner. The same Certificate can be re-created identically
  (idempotence via the composite key `(attestationId, format)`).

## 2. Blob format

A Certificate v1 is an ASCII string with 3 parts separated by dots,
each one in base64url (no padding):

```
v1.<payload>.<signature>
```

- `v1`: literal version.
- `<payload>`: canonicalized JSON then base64url. Top-level keys
  sorted lexicographically before stringify.
- `<signature>`: HMAC-SHA256 of the `<payload>` (base64url text, not
  the JSON bytes), with `CERT_SIGN_SECRET` on the server side.

## 3. Canonical payload

```json
{
  "attestationId": "cm123…",
  "certificateId": "cm456…",
  "issuedAt": "2026-11-14T12:00:00.000Z",
  "issuer": "bitquest.example.com",
  "kind": "QUEST",
  "metadata": {
    "xpEarned": 150,
    "satsEarned": 100,
    "questCode": "genesis",
    "issuedAtEpoch": 1763121600000
  },
  "pseudo": "satoshi",
  "targetCode": "genesis",
  "targetTitle": "The Genesis Block",
  "userId": "cm789…",
  "v": 1
}
```

Keys are **always sorted** on the server side before signing, so that
two Certificates for the same attestation produce exactly the same
blob (determinism). A verifier must therefore sort too before
re-signing if verifying from raw JSON.

**Types**:
- `userId`, `attestationId`, `certificateId`: cuid (string).
- `issuedAt`: ISO 8601 string.
- `kind`: `QUEST | COURSE | BADGE_EARNED` (v1: only `QUEST` is emitted
  automatically by the event-bus handler).
- `metadata`: free-form object, depends on the kind. For `QUEST`:
  `{ xpEarned, satsEarned, questCode, issuedAtEpoch }`.
- `v`: literal `1`.

## 4. Verification

### 4a. Via the public endpoint

```bash
curl -s "https://bitquest.example.com/api/certificates/verify?blob=v1.XXX.YYY"
```

Response:
```json
{
  "ok": true,
  "payload": { /* as above */ }
}
```

- Rate-limit IP 60/60s (BATCH 29).
- Content-Type: `application/json` with headers
  `X-Protocol-Version: 1` + `X-Certificate-Version: 1`.
- Returns `{ ok: false, error }` + status 400 if signature invalid.

### 4b. Local verification (not possible in v1)

In v1, the signature is symmetric (HMAC). Only the server holding
`CERT_SIGN_SECRET` can re-sign and verify. This is intentionally
constrained to simplify rollout — v2 Schnorr will open offline
verification to any client that knows the instance's pubkey (NIP-11
Nostr style).

## 5. Identify the originating BitQuest instance

```bash
curl -s https://bitquest.example.com/api/version
```

Returns:
```json
{
  "protocolVersion": 1,
  "certificateVersion": 1,
  "release": "0.4.0",
  "commitHash": "abc1234",
  "issuer": "bitquest.example.com",
  "builtAt": "2026-11-15T17:00:00Z"
}
```

The `issuer` field **must** match the `issuer` field of the
Certificate payload for verification to make sense. If a learner
presents a cert issued by `bitquest-rogue.example.com`, it is not an
official BitQuest Certificate.

## 6. Lifecycle

1. Learner completes a quest → event-bus `quest.completed` →
   `createQuestAttestation` creates an Attestation in the DB.
2. Learner clicks "Export" on `/attestations` → POST
   `/api/me/attestations/[id]/certificate` → Certificate row created
   in the DB (format="JSON_V1"), signed blob returned to client.
3. Learner downloads the `.txt` file or copies the
   `?blob=...` link → shares with a third party.
4. Third party opens the link → `/verify` page displays the decoded
   payload + emerald "Verified" badge.

## 7. Roadmap v2 (NIP-11 Nostr preparation)

- Schnorr-secp256k1 signature (secp256k1 BIP-340).
- Instance public key published in `/.well-known/nostr.json`
  (NIP-11) + `pubkey` field in `/api/version`.
- Offline verification by any client that has the pubkey
  (no network required).
- Blob format: `v2.<payload>.<schnorr_sig_hex>`.
- Backward compat: the server accepts both versions at verify
  (pattern from BATCH P0.1/P0.3 on the deep-link protocol side).

## 8. References

- BATCH 25: event-bus handler `createQuestAttestation`
  (`src/lib/handlers/attestations.ts`).
- BATCH 28: HMAC signature + emit route (`src/lib/certificates/sign.ts`,
  `src/app/api/me/attestations/[id]/certificate/route.ts`).
- BATCH 29: public verify route
  (`src/app/api/certificates/verify/route.ts`).
- BATCH 30: `/verify` page UI (`src/app/verify/page.tsx`).
- BATCH 42/43: headers `X-Protocol-Version` + `X-Certificate-Version`.
- BATCH 44: endpoint `/api/version`.
