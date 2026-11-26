# BitQuest ↔ BitLab Integration — 2026-11-09

> Technical analysis of the integration between BitQuest (`./`) and BitLab (`../bitlab/`), based on the exploration of the BitLab repository (`../bitlab/src/`, `../bitlab/package.json`, `../bitlab/README.md`). **No modification of BitLab is proposed in this audit phase.**

---

## 1. Current state: nothing is wired

BitQuest contains 8 mission types `block_explorer`, `key_forge`, `tx_builder`, `mine_nonce`, `ln_channel`, `ln_invoice`, `multisig_sign`, `taproot_tweak` (`src/lib/bitquest/missions.ts`), **all executed in server-side simulation**. The UI text mentions "BitLab Sandbox" (`src/components/bitquest/mission-panel.tsx`), but no line of code contacts the BitLab repository:

- No `bitlab.*` URL in the code.
- No dedicated `window.addEventListener("message", ...)` listener.
- No outbound HTTP request to BitLab.
- No `@scure/*`, `@noble/*` imports, no Lightning lib.

**The integration must be designed and built from scratch.**

---

## 2. What BitLab offers to BitQuest

Excerpts confirmed by direct reading of `../bitlab/`:

### 2.1 Security model (`../bitlab/README.md:26-33`)
- Private keys and mnemonics **only in the browser** (IndexedDB).
- The BitLab backend is a **read-only proxy** to `mempool.space` + broadcast of raw transactions (`../bitlab/src/app/api/bitcoin/route.ts:245-422`).
- Zero BitLab user authentication.
- Two real LDK nodes compiled to WASM, executed in a Web Worker.

### 2.2 API routes exposed by BitLab

| Method | Route | Role |
|---|---|---|
| GET | `/api` | Health check |
| GET | `/api/bitcoin?path=...&network=...` | Esplora proxy with regex allow-list |
| POST | `/api/bitcoin?path=tx&network=...` | Broadcast raw tx hex |
| POST | `/api/mine/submit` | Submit Testnet4/Regtest mined block |
| GET | `/api/regtest/info` | Embedded regtest state |
| POST | `/api/regtest/faucet` | Regtest faucet |
| POST | `/api/regtest/mine` | Mine N regtest blocks |

**No BitLab route is designed to produce or validate a proof for a third-party service.** BitLab is today an **autonomous rich client**.

### 2.3 Lightning capabilities (`../bitlab/src/lib/lightning.ts`)

- `lnLab.createInvoice(node, amount, desc, expiry)` → signed BOLT11.
- `lnLab.createOffer(node, amount, desc)` → BOLT12.
- `lnLab.payInvoice(node, bolt11, amount)` → `payment_sent` event in the journal.
- **No standard WebLN exposure** (`window.webln` not implemented).

---

## 3. Technical compatibility

| Criterion | BitQuest | BitLab | Verdict |
|---|---|---|---|
| Next.js | 16.1.1 | 16.4.3 | ✅ Compatible |
| React | 19.0.0 | 19.3.1 | ✅ Compatible |
| TypeScript | 5.x | 5.9.3 | ✅ |
| Shadcn/ui + Radix | Yes | Yes | ✅ Reusable design system |
| Zustand | 5.0.6 | 5.0.16 | ✅ |
| TanStack Query | 5.82 | 5.104 | ✅ |
| Database | SQLite (target Postgres) | None (browser IndexedDB) | ⚠️ Full isolation |
| Authentication | Custom session | None | ⚠️ SSO to design |
| Runtime | Node | Bun ≥ 1.2 | ⚠️ To harmonize or document |
| License | AGPL-3.0 | MIT | ✅ MIT ⊂ AGPL; BitQuest can consume BitLab |

---

## 4. Three possible integration architectures

### Option A — iframe + postMessage (fast MVP)

```
BitQuest ──(opens)──> <iframe src="bitlab.io/?mission=...&challenge=JWT">
   ▲                       │
   │                       │ user acts
   │                       │
   └──(postMessage)────────┘  { proof: txid, bolt11, ... }
          │
          ▼
   BitQuest /api/bitlab/proof: verifies against mempool.space
```

**Benefits**: zero change on the BitLab side if we're content with a passive iframe + reading of displayed proofs. No CORS if BitLab enables CORS on the relevant routes.
**Drawbacks**: heavy UX (iframe in page), fragile proof parsing, risk if the user drops the proof manually.

### Option B — Deep-link + JWT challenge/response (recommended)

```
BitQuest issues a MissionChallenge (JWT signed HS256, expiry 1h) containing:
  { userId, questCode, missionKind, network, requiredAction, nonce }
         │
         ▼
redirect https://bitlab.gandalnexus.io/?mission=<id>&challenge=<jwt>&returnTo=<url>
         │
BitLab reads the JWT, preloads the right UI (tx-builder or lightning)
         │
user acts: builds tx, opens channel, mines block, pays invoice
         │
BitLab POST → https://bitquest.gandalnexus.io/api/bitlab/proof
   { challenge: jwt, proof: { kind: "TXID"|"BOLT11"|"BLOCK_HASH", value, network } }
         │
BitQuest verifies:
  - JWT signature (not expired, nonce not consumed)
  - proof:
      TXID → mempool.space/{network}/api/tx/{txid}, verify expected outputs
      BOLT11 → bolt11-decoder library, amount + description
      BLOCK_HASH → mempool.space/{network}/api/block/{hash}
         │
BitQuest marks the quest COMPLETED, logs in BitLabProof
```

**Benefits**:
- No private key crosses the two apps.
- 100% server-side validation on the BitQuest side.
- Replay-safe (nonce + expiry).
- Compatible with separate deployments.

**Drawbacks**:
- Requires a small modification on the BitLab side (reading the query param + sending the proof at the end of the action). Minimal change, to be discussed with the BitLab maintainer.
- Two redirects for the user (UX to polish).

**Effort**: ~10 dev-days, mostly on the BitQuest side.

### Option C — Monorepo + common app shell (long term)

```
/gandalnexus-monorepo
   ├─ apps/bitquest
   ├─ apps/bitlab
   ├─ packages/ui          (shared shadcn)
   ├─ packages/bitcoin-core (proofs, verifications)
   └─ packages/auth        (session + JWT)
```

**Benefits**: same-origin possible (`/learn` and `/lab` on the same domain), shared Zustand store, transverse type safety, a single CI/CD pipeline, code savings.

**Drawbacks**:
- Heavy refactor, > 3 weeks.
- Strong coupling: a bug in one package can block both apps.
- License reorganization (BitLab MIT, BitQuest AGPL-3.0) to document.

**Effort**: ~20 dev-days.

---

## 5. Recommendation

| Horizon | Reco |
|---|---|
| **Short term** (phase 2-3 roadmap) | Option **B**: deep-link + JWT challenge/response. Allows delivering a real integration without compromising security, with minimal impact on BitLab. |
| **Long term** (after stable production launch) | Evaluate Option **C** if the team grows and if we target a unified GandalNexus offering (common sidebar, fluid navigation). Don't rush: we would lose BitLab's independence (MIT, general-public project) if we mix AGPL-3.0 into its code. |

**Option A (iframe) not recommended**: fragility and UX inferior to option B for equivalent effort.

---

## 6. Target functional flow (option B detailed)

Example: quest `tx-basics` (Anatomy of a transaction) on Testnet4.

### 6.1 Steps

1. **In BitQuest**: the learner finishes the theory, passes the quiz at 70%.
2. The "Launch mission in BitLab" button becomes active. It triggers `POST /api/bitlab/challenge` which returns:
   ```json
   {
     "challengeJwt": "eyJ...",
     "deepLinkUrl": "https://bitlab.gandalnexus.io/?mission=tx-basics&challenge=eyJ..."
   }
   ```
3. The learner clicks. **Redirect** to BitLab (new tab recommended to preserve BitQuest state).
4. **In BitLab**: the `mission=tx-basics` query param activates the tx-builder tab. The JWT is read, displayed as a banner ("BitQuest Mission: build a transaction of X sats to Y"). The JWT is **not** sent to the BitLab server, only displayed to the user and stored in local memory.
5. The learner builds the transaction, signs it (key in IndexedDB), broadcasts it via `POST /api/bitcoin?path=tx&network=testnet4` (existing BitLab service).
6. BitLab receives a `txid`. It then POSTs to BitQuest:
   ```http
   POST https://bitquest.gandalnexus.io/api/bitlab/proof
   Content-Type: application/json

   {
     "challenge": "eyJ...",
     "proof": { "kind": "TXID", "value": "abcd1234...", "network": "testnet4" }
   }
   ```
7. **In BitQuest**: `/api/bitlab/proof`:
   - Verifies the JWT signature.
   - Verifies that the `nonce` has not already been consumed (`RewardIdempotencyKey` table).
   - Fetches `https://mempool.space/testnet4/api/tx/{txid}`.
   - Compares outputs to the expected stored in `missionConfig`.
   - If OK: marks `UserQuestProgress.status = COMPLETED`, assigns XP + sats, logs a `BitLabProof`, returns `200 OK`.
8. BitLab displays "Mission validated!" and offers a `returnTo` to BitQuest.
9. **Return to BitQuest**: the dashboard reflects the completed quest, possible badge unlocked.

### 6.2 JWT model

```json
{
  "iss": "bitquest",
  "sub": "user_abc123",
  "aud": "bitlab",
  "exp": 1794960000,
  "iat": 1794956400,
  "jti": "nonce-uuid-v4",
  "questCode": "tx-basics",
  "missionKind": "BITLAB_PROOF",
  "network": "testnet4",
  "requiredAction": "TX_WITH_OUTPUT",
  "params": { "outputAddress": "tb1q...", "minAmount": 10000 }
}
```

Signed `HS256` with a secret stored only on the BitQuest side. BitLab doesn't need to verify it, only to transport it.

### 6.3 Anti-abuse verifications

- `jti` unique; kept in `RewardIdempotencyKey` until `exp`.
- Rate limit per `userId` (5 attempts / hour).
- Detection: the same `txid` appearing for two different users → flag.
- Timestamp: the tx must be later than the `iat` of the challenge (prevents replaying an old transaction).

---

## 7. Minimal changes to request on the BitLab side

For option B, the expected patches on the BitLab side are minimal (not to be done in this audit phase):

1. **Reading the `mission` query param in `../bitlab/src/app/page.tsx`**: tab selection accordingly (tx-builder, lightning, miner, etc.).
2. **Reading the `challenge` query param**: storage in memory, display of a "BitQuest Mission in progress" banner.
3. **Completion hook**: when an action succeeds (tx broadcast, invoice paid, block mined), trigger a `reportProof(proof)` function that POSTs to the `returnTo` URL + endpoint `/api/bitlab/proof`.
4. **CORS**: allow `Origin: https://bitquest.gandalnexus.io` on the return endpoint (this will be BitQuest that exposes it, not BitLab, so actually nothing to do on the BitLab side if it's a simple fetch on the BitLab client side).

**BitLab effort estimated**: 2-3 days. To be scoped and planned with the BitLab maintainer in a later phase.

---

## 8. Alternatives without BitLab modification

If BitLab cannot be modified immediately, three substitutes are possible on the BitQuest side:

1. **"Copy-paste" proof**: the learner opens BitLab alone, performs the action, copies the `txid`/`bolt11` and pastes it into BitQuest. Identical server-side validation. Degraded but functional UX.
2. **Keep server simulation** (existing) in phase 1 and evolve BitLab in parallel. The "learn → practice" promise becomes "learn → practice-simulated". To be assumed in product communication.
3. **A "proxy practice" on the BitQuest side**: BitQuest embeds a minimal subset of BitLab (e.g. just the mini tx-builder for a mission) in a sandboxed iframe, without waiting for BitLab. **Discouraged**: code duplication, violates the DRY principle between the two apps.

---

## 9. License constraints

- BitLab: **MIT** (permissive).
- BitQuest: **AGPL-3.0** (strong copyleft).

BitQuest can **consume** BitLab without conflict, provided that the BitQuest distribution remains AGPL-3.0 and that the consumed BitLab code is redistributed under MIT (preserving the license notice).

To **avoid**: copying BitQuest code (AGPL) into BitLab (MIT) — this would "contaminate" BitLab.
To **avoid**: merging the repository into a monorepo without clearly separating packages by license.

---

## 10. Integration checklist (tickets to open)

- [ ] `ADR-01 Integration BitLab — Option B retained`
- [ ] `[BitQuest] Model BitLabProof (Prisma migration)`
- [ ] `[BitQuest] Model RewardIdempotencyKey (Prisma migration)`
- [ ] `[BitQuest] Service MempoolClient (fetch mempool.space, timeout, retries)`
- [ ] `[BitQuest] Lib bolt11-decoder verified (choose maintained package, sec audit)`
- [ ] `[BitQuest] POST /api/bitlab/challenge (issue JWT)`
- [ ] `[BitQuest] POST /api/bitlab/proof (verify + reward)`
- [ ] `[BitQuest] UI deep-link button in mission-panel.tsx`
- [ ] `[BitQuest] JWT secret rotation policy documented`
- [ ] `[BitLab] (later) Query param reading + mission banner + reportProof hook`
- [ ] `[Doc] Learner guide: "How to validate a mission in BitLab"`
- [ ] `[Sec] Pentest of the challenge/proof flow`

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| An existing `txid` that does not correspond to the exercise | XP/sats fraud | Compare outputs / amounts to the challenge |
| Challenge stolen via log/URL | Potential replay | Nonce + idempotency key + short expiry |
| `mempool.space` unavailable | Validation blocking | Timeout, fallback to a second explorer (blockstream.info), async verification queue |
| BitLab modified by a contributor and breaks the hook | Silent integration breakage | Contract tests on the BitQuest side (mock of expected proof), monitoring of valid proof rate |
| AGPL-3.0 license "contaminates" BitLab | Loss of BitLab adoption | Keep repos separate, never import AGPL code into BitLab |
| Unstable Lightning testnet | LN missions blocked | Plan Testnet3 **and** Regtest missions (BitLab handles both) |

---

**Written on**: 2026-11-09
**Next deliverable**: `BITQUEST_ROADMAP.md`
