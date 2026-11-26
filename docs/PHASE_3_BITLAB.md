# PHASE_3 — BitLab Integration

**Creation date**: 2026-11-10
**Last update**: 2026-11-11
**Status**: end-to-end pipeline operational for 5 quests
(`tx-basics`, `utxo`, `fees-mempool`, `lightning-invoice`, `lightning`);
`CHANNEL` supported on mainnet (mempool.space) and testnet/signet/regtest
via external LND REST (dedicated infra in `docker-compose.dev.yml`, profile
`lnd`). Audit log enabled. Optional HMAC-signed deep-link. CSV export
from the admin console.

## What Is Delivered

### Data model
- `BitLabProof`: proof persisted per `(userId, questCode, kind)`
- 5 kinds: `TX | BLOCK | INVOICE | CHANNEL | ADDRESS`
- 3 networks: `testnet4 | signet | regtest` (mainnet explicitly refused
  on the tx/block side to preserve the pedagogy "no real value")
- `consumed` flag consumed by `/api/quests/[code]/progress` when the
  mission is validated (see *Quest wiring*)

### `MempoolClient` service
- `src/lib/bitlab/mempool.ts`
- `getTransaction(network, txid)`, `getBlock(network, hash)`,
  `getAddressStats(network, address)` (P0.4)
- Automatic fallback `mempool.space` → `blockstream.info`
- 5s timeout + `AbortController`
- Structured logs via `logger("mempool")`

### CHANNEL verification (P2.4) — two levels
- `src/lib/bitlab/channel.ts`
- `ONCHAIN` (default): lookup via LND REST (testnet/signet/regtest) or
  mempool.space (mainnet). Strong verification.
- `DECLARATIVE`: scid regex only, no network call. Reserved for
  pedagogical quests without a real sats reward.
- Declared per quest via `missionConfig.channelVerifyLevel`.
- Enriched payload: `verifyLevel: "ONCHAIN" | "DECLARATIVE"` + associated `source`.

### Address verification (P0.4) — two levels
- `src/lib/bitlab/address.ts`
- `validateAddressFormat(network, address)`: prefix + charset + length
  per network (tb1 bech32 / m/n/2 base58 for testnet4+signet; bcrt1 for
  regtest; mainnet refused). No full checksum (deferred to USED level).
- `parseAddressVerifyLevel(missionConfig)`: reads `addressVerifyLevel` from
  the mission config (default `FORMAT`).
- Two levels declared by the quest:
  - `FORMAT` (default): local validation only, no network request.
  - `USED`: `FORMAT` + mempool check (address must have `fundedTxoCount ≥ 1`).
- `/api/bitlab/proof` route, `kind: ADDRESS` branch:
  - 400 if `payload.address` missing or format invalid.
  - 404 if `USED` level and the explorer doesn't know the address.
  - 409 if `USED` level and the address has never been credited.
  - Success: enriches `payload.format`, `payload.verifyLevel`, and for
    `USED` adds `fundedTxoCount`, `fundedTxoSumSats`, `txCount`.

### BOLT11 decoding
- `src/lib/bitlab/bolt11.ts` (npm `bolt11` lib)
- Extraction of `amountSats`, `network`, `paymentHash`, `expiry`
- Called from `/api/bitlab/proof` for `kind=INVOICE` (400 if invalid)

### Two-dimensional rate-limiting (userId + IP)
Each BitLab route applies **two** rate-limits in Redis (in-memory fallback):

| Route | userId limit (×/60s) | IP limit (×/60s) |
|---|---|---|
| `/api/bitlab/challenge` | 30 | 120 |
| `/api/bitlab/proof` | 20 | 80 |
| `/api/bitlab/deep-link` | 30 | 120 |
| `/api/bitlab/deep-link/verify-return` | 60 | 240 |

- **IP first** (before `authenticate`): protects against unauthenticated DoS.
- Extraction via `clientIp(req)` (`src/lib/bitquest/session.ts`): priority
  `x-forwarded-for` (first IP), fallback `x-real-ip`, fallback `"unknown"`
  (shared fail-closed bucket).
- ×4 userId→IP ratio to tolerate NAT (families, schools, corporate VPN).
- **Required in prod**: a trusted reverse proxy (nginx/caddy) that rewrites
  `x-forwarded-for`. Without a proxy, a client could spoof the header.

### BitQuest ↔ BitLab protocol versioning (`PROTOCOL_VERSION = 1`)
- Single source in `src/lib/bitlab/protocol.ts`; shared by the JWT challenge
  and the HMAC-signed deep-link.
- Emission: both channels always carry `v: PROTOCOL_VERSION`.
- Reception: `v > PROTOCOL_VERSION` rejected (anti-downgrade), `v < 1` or non-integer
  rejected, absent `v` tolerated with legacy fallback (grace ≤ TTL: 1h JWT / 1h HMAC).
- Both `/api/bitlab/challenge` and `/api/bitlab/deep-link` routes return
  `protocolVersion` in their JSON to allow the BitLab client to negotiate.

### JWT challenge (anti-replay) — versioned protocol `v: 1`
- `src/lib/bitlab/jwt.ts` — `jose` HS256
- `POST /api/bitlab/challenge` issues a JWT containing
  `{ v, userId, questCode, kind, nonce, exp (1h) }` and also returns
  `protocolVersion` in the JSON body so the client can negotiate.
- `POST /api/bitlab/proof` **requires** this JWT (`min 16 chars`). Checks:
  signature, expiry, nonce consumed via Redis `SET NX EX`, correspondence
  `(userId, questCode, kind)`, **protocol version** (`v > PROTOCOL_VERSION` rejected,
  absent `v` tolerated for pre-versioning tokens during the expiry window).
- Export `PROTOCOL_VERSION` from `jwt.ts` — bump only if an evolution
  breaks existing tokens (not for a mere optional addition).
- Secret: `BITLAB_JWT_SECRET` (fallback `CSRF_SECRET` in dev)
- Rate-limit: `rateLimit("bitlab-challenge:<user>", 30, 60s)` on issuance,
  `rateLimit("bitlab-proof:<user>", 20, 60s)` on submission (Redis backend
  if `REDIS_URL`, otherwise in-memory).
- Tests: `src/lib/bitlab/jwt.test.ts` (16 tests — issuance, versioning,
  anti-replay via Redis mock, claims, signature, expiry).

### `LightningClient` service (mempool)
- `src/lib/bitlab/lightning.ts`
- `getChannel(scid)` via `mempool.space/api/v1/lightning/channels/{id}`
- Normalization to `ChannelInfo` (capacity, status, pubkeys, chan_point)
- Dispatcher `resolveChannel(network, scid)` — see below

### `LndClient` service (testnet/signet/regtest)
- `src/lib/bitlab/lnd.ts`
- Queries `GET /v1/graph/edge/{chan_id}` of an external LND node
- `scidToChanId(scid)` encodes `<block>x<tx>x<vout>` into chan_id uint64
  (BOLT 07)
- `getChannelViaLnd(id, cfg)` via `node:https` with macaroon header
  (`Grpc-Metadata-macaroon`) and self-signed TLS support
- Configuration via env (see § *LND config*)
- Dedicated Docker testnet infra: see
  [`docs/DOCKER_LND.md`](DOCKER_LND.md) to launch an lnd node via
  `docker compose --profile lnd` and extract credentials

### Lightning dispatcher
- `resolveChannel(network, scid)` in `lightning.ts`
  - `testnet4 | signet | regtest` → LND if configured, otherwise
    `source="unavailable"` (handler responds 501)
  - others → mempool.space
  - returns `{ channel, source: "lnd" | "mempool" | "unavailable" }` —
    the source is persisted in `payload.source` for audit

### `/api/bitlab/proof` endpoint
- Auth required + conditional CSRF + rate limit 20/min
- JWT challenge **mandatory**
- Business verification per kind:
  - **TX**: explorer lookup, requires `confirmed === true` (409 otherwise)
  - **BLOCK**: explorer lookup, enriches `height` + `tx_count`
  - **INVOICE**: BOLT11 decoded and validated (400 if invalid)
  - **CHANNEL**: `resolveChannel` (LND or mempool), 501 if testnet
    network without LND, 404 if channel unknown
  - **ADDRESS**: accepted as-is (local derivation not verifiable
    server-side without xpub)
- Idempotent upsert on `(user, quest, kind)`

### Validation
- `bitlabProofSchema` and `bitlabChallengeSchema` in
  `src/lib/validation/schemas.ts`
- `questCode` kebab-case, strict enums on `kind` and `network`
- Free `payload` (each kind has its expected fields on the handler side)
- `challenge` required (min 16 chars)

### Quest wiring — 5 BITLAB_PROOF quests
- Field `Quest.missionKind = "SIMULATED" | "BITLAB_PROOF"` in Prisma
- Seed (`prisma/seed.ts`) marks as `BITLAB_PROOF`:
  - `tx-basics` (kind=TX, historical pilot)
  - `utxo` (kind=TX, intermediate — real UTXO construction on testnet)
  - `fees-mempool` (kind=TX, intermediate — tx with calibrated fees)
  - `lightning-invoice` (kind=INVOICE, advanced — BOLT11 decoded server-side)
  - `lightning` (kind=CHANNEL, advanced — SCID verified via LND testnet).
    **Requires** LND configured (cf. `docs/DOCKER_LND.md`). Without LND,
    `/api/bitlab/proof` responds 501 UNAVAILABLE on each attempt.
- The others stay `SIMULATED`: `key_forge` (local crypto),
  `mine_nonce` (impossible to mine), `multisig_sign`/`taproot_tweak`
  (crypto exercises without broadcast), `block_explorer`/`genesis`
  (gentle introduction for beginners)
- `/api/quests/[code]/progress` action `mission_submit` branches:
  - `missionKind === "BITLAB_PROOF"` → looks for a `BitLabProof`
    with `consumed=false` for `(user, quest)`, marks it consumed and
    chains the rewards (XP, sats, badges, streak bonus)
  - `missionKind === "SIMULATED"` → unchanged historical flow

### Audit log — BitLabProofAttempt
- Prisma model `BitLabProofAttempt`: `userId`, `questCode`, `kind`,
  `network`, `outcome`, `reasonMessage?`, `latencyMs`, `createdAt`
- Outcomes: `ACCEPTED | REJECTED | NOT_FOUND | UNAVAILABLE |
  INVALID_JWT | MEMPOOL | BAD_REQUEST | RATE_LIMITED`
- Helper `recordProofAttempt` + `fireProofAttempt` (fire-and-forget)
  in `src/lib/bitlab/audit.ts`
- Called from every exit path of `/api/bitlab/proof` (success
  and refusal). Latency measured server-side, useful to detect
  mempool/LND degradation
- Indexes `(userId, createdAt)`, `(questCode, createdAt)`,
  `(outcome, createdAt)` for later admin queries

### Quest-player UI
- `BitLabProofStep` in `src/components/bitquest/quest-player.tsx`
- Displayed when `quest.missionKind === "BITLAB_PROOF"` at the mission step
- Fields: txid/hash + network selector + deep-link to BitLab
  (`NEXT_PUBLIC_BITLAB_URL`)
- "Verify my proof" button chains:
  1. `/api/bitlab/challenge` → JWT
  2. `/api/bitlab/proof` → persists the proof
  3. parent `mission_submit` → consumes the proof, grants
     rewards
- Bidirectional deep-link: "Open in BitLab" builds the URL via
  `buildBitlabDeepLink` (see § *Deep-link protocol*) and navigates in
  the same tab. On return with `?bitlab_result=1`, `parseBitlabReturn`
  pre-fills the form and cleans the URL via `router.replace`.
- `missionKind` exposed in `QuestState` (listing) and `QuestDetail.quest`
  (detail) + types `src/lib/bitquest/client.ts`
- Helper `toBitlabKind(missionType)` in `src/lib/bitlab/mission-kinds.ts`
  to derive the expected BitLab kind from the quest missionType

### BitQuest ↔ BitLab deep-link protocol
- `src/lib/bitlab/deep-link.ts` — pure helpers (24 tests)
- Server endpoints: `POST /api/bitlab/deep-link` (signed sender) and
  `POST /api/bitlab/deep-link/verify-return` (verify on return)

**Sender** (BitQuest → BitLab): `GET ${NEXT_PUBLIC_BITLAB_URL}?` with
params:
- `questCode`: kebab-case code of the BitQuest quest
- `kind`: `TX | BLOCK | INVOICE | CHANNEL | ADDRESS`
- `network`: `testnet4 | signet | regtest`
- `returnTo`: absolute BitQuest URL to send the learner back to
- optional *extras* (e.g. `target`, `feeSats`) pulled from `missionConfig`
- `ts` and `sig` (**if** `BITLAB_SIGN_SECRET` configured): unix
  timestamp + HMAC-SHA256 base64url. BitLab must echo them intact on
  return redirect.

**Receiver** (BitLab → BitQuest): redirects to `${returnTo}?` with:
- `bitlab_result=1` (origin flag, mandatory)
- `kind`, `network` (sender echoes)
- One of the following fields depending on kind:
  - `txid=<hex64>` for TX
  - `hash=<hex64>` for BLOCK
  - `bolt11=<lnXXX>` for INVOICE
  - `scid=<block>x<tx>x<vout>` or chan_id for CHANNEL
    → on the BitLab side, `LnChannelView.scidFormatted` provides the expected
    format (see `bitlab/docs/channel-scid.md` — auto CTA coming)
  - `address=<base58/bech32>` for ADDRESS
- `ts` and `sig` echoed (if sender sent them)

BitQuest on reception:
1. Validates `bitlab_result=1`, known `kind`, non-empty `network`, well-formed
   value (regex per kind — hex64 for TX/BLOCK, `ln…` for
   INVOICE, scid or chan_id for CHANNEL, bech32/base58 for ADDRESS)
2. Checks that `kind` matches the current quest (avoids
   inter-quest collision)
3. If `ts+sig` present, calls `/api/bitlab/deep-link/verify-return`
   → server recomputes HMAC and compares (timing-safe). If enforced and
   invalid: error toast and URL cleanup without pre-filling
4. Otherwise: pre-fills the form + cleans the URL. The learner remains
   master of the "Verify" click (no auto-submit, deliberate decision
   to maintain explicit consent before engaging the JWT challenge)

### HMAC deep-link signature (optional)
- Env var `BITLAB_SIGN_SECRET`: secret HMAC key (at least
  16 bytes). If absent, deep-links are not signed and
  `/api/bitlab/deep-link/verify-return` responds `{ ok: true, enforced:
  false }`
- Canonical signed payload: `${userId}|${questCode}|${kind}|${network}|${ts}`
- Algorithm: HMAC-SHA256, base64url encoding, max age 1h
- `signDeepLinkPayload` + `verifyDeepLinkPayload` in
  `src/lib/bitlab/deep-link.ts` (timing-safe via `crypto.timingSafeEqual`)
- Threat model covered: a third party who intercepted a return link
  cannot forge a BitLab return for the quest (bound to
  `userId`), cannot replay after 1h, cannot use it for another quest
  (bound to `questCode`)

## What Is NOT Delivered (by choice)

1. **No `AdminAuditLog` audit** on `/api/bitlab/proof`: it is a
   learner action, not an admin mutation.
2. **No deep-link callback UI** in `mission-panel.tsx`: the
   "Open in BitLab" button opens `NEXT_PUBLIC_BITLAB_URL` in a new tab,
   without yet a JWT + callback round-trip (optional, roadmap).
3. **ADDRESS not verified**: deriving an address from an xpub
   is purely client-side; no server lookup currently.

## LND Config

Environment variables required to enable CHANNEL verification
on testnet/signet/regtest:

```bash
LND_REST_URL=https://my-lnd-node.local:8080
LND_MACAROON_HEX=0201036c6e64...   # readonly.macaroon hex-encoded
# TLS precedence (only one to use):
LND_TLS_CERT_B64=LS0tLS1CRUdJTi...  # tls.cert PEM encoded in base64 (prod)
LND_TLS_INSECURE=1                  # dev only: accepts a self-signed cert
```

Generation of values from an LND node:

```bash
# Macaroon → hex
xxd -p -c 1000 ~/.lnd/data/chain/bitcoin/testnet/readonly.macaroon

# TLS cert → base64 (single line, Docker/CI portable)
base64 -i ~/.lnd/tls.cert | tr -d '\n'
```

**TLS precedence** (in the client):
1. If `LND_TLS_CERT_B64` is provided: the cert is used as a pinned CA
   (`rejectUnauthorized=true`). Any other CA is refused, even a valid
   system one.
2. Otherwise if `LND_TLS_INSECURE=1`: `rejectUnauthorized=false`. Dev only.
3. Otherwise: strict verification against the system CA (sufficient for a
   Let's Encrypt signed cert).

Without `LND_REST_URL` + `LND_MACAROON_HEX`, `kind=CHANNEL` proofs on
testnet receive a `501 Not Implemented` with an explanatory message.

## API — examples

### Issue a JWT challenge

```bash
curl -X POST http://localhost:3000/api/bitlab/challenge \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{ "questCode": "tx-basics", "kind": "TX" }'
# → { ok, token, nonce, expiresAt }
```

### Submit a transaction proof

```bash
curl -X POST http://localhost:3000/api/bitlab/proof \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{
    "questCode": "tx-basics",
    "kind": "TX",
    "network": "testnet4",
    "payload": { "txid": "aabbcc...00" },
    "challenge": "<JWT>"
  }'
```

Expected responses:
- `200 { ok, proof }` — tx confirmed, proof persisted
- `409 { error, mempool:true }` — tx in mempool, not yet confirmed
- `404 { error }` — tx not found on both explorers
- `400 { error }` — malformed txid, invalid JWT, or unknown quest

### Submit a Lightning channel proof

```bash
curl -X POST http://localhost:3000/api/bitlab/proof \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{
    "questCode": "open-channel",
    "kind": "CHANNEL",
    "network": "testnet4",
    "payload": { "scid": "859100x1234x0" },
    "challenge": "<JWT>"
  }'
```

Expected responses:
- `200 { ok, proof }` — channel found, `payload.source` indicates `lnd`
  or `mempool`
- `404 { error }` — channel unknown to the LND node / mempool
- `501 { error }` — testnet/signet/regtest without LND config
- `400 { error }` — malformed scid or invalid JWT

### Audit log admin UI
- `/admin/bitlab/attempts` — SSR page gated by ADMIN role (via layout)
- 24h stats in header: total attempts, acceptance %, weighted
  average latency
- Breakdown by outcome with average latency/outcome
- Combinable filters: outcome (8 chips) + questCode (dynamic chips
  from present codes)
- Paginated table (max 100) with pseudo, questCode, kind, network,
  colored outcome badge, latency, timestamp, reasonMessage
- "BitLab proofs (24h)" tile added on `/admin` (overview)
- Admin NAV: new entry "BitLab proofs"
- CSV export: "Export CSV" button that respects current filters.
  `GET /admin/bitlab/attempts/export?outcome=…&quest=…` returns up to
  10,000 lines (hard cap) UTF-8 with BOM (Excel compatibility). Columns:
  id, createdAt, userId, pseudo, questCode, kind, network, outcome,
  latencyMs, reasonMessage. Timestamped filename with filters.

## Next Steps (roadmap)

The PHASE_3 roadmap is covered. Possible follow-ups (out of immediate scope):

1. **End-to-end LND test** — open a real testnet channel and run
   the `lightning` quest end-to-end to validate the flow on a
   freshly initialized LND node (cf. `docs/DOCKER_LND.md`).
2. **Phase 4** — TBD: advanced Lightning pedagogy (routing,
   backups, AMP), or shift to multi-node regtest for channel
   management exercises on a closed network.

## Audit & logs

Each accepted proof emits a `[INFO] bitlab-proof · bitlab proof
accepted` log with `{ userId, questCode, kind, network }`. On explorer
lookup failure, the log is `[WARN] mempool · tx lookup failed` (or
`lightning · channel lookup failed`, or `lnd · lnd channel lookup failed`)
with the underlying error detail.

No `AdminAuditLog` audit on these endpoints: these are not
admin mutations.
