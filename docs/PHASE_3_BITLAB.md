# Phase 3 — BitLab Integration

**Date de création** : 2026-11-10
**Dernière mise à jour** : 2026-11-11
**Statut** : chaîne bout-en-bout opérationnelle pour `tx-basics` ;
`CHANNEL` supporté sur mainnet (mempool.space) et sur testnet/signet/regtest
via LND REST externe.

## Ce qui est livré

### Modèle de données
- `BitLabProof` : preuve persistée par `(userId, questCode, kind)`
- 5 kinds : `TX | BLOCK | INVOICE | CHANNEL | ADDRESS`
- 3 réseaux : `testnet4 | signet | regtest` (mainnet explicitement refusé
  côté tx/block pour conserver la pédagogie « pas de vraie valeur »)
- Flag `consumed` consommé par `/api/quests/[code]/progress` quand la
  mission est validée (voir *Wiring quête*)

### Service `MempoolClient`
- `src/lib/bitlab/mempool.ts`
- `getTransaction(network, txid)` et `getBlock(network, hash)`
- Fallback automatique `mempool.space` → `blockstream.info`
- Timeout 5s + `AbortController`
- Logs structurés via `logger("mempool")`

### Décodage BOLT11
- `src/lib/bitlab/bolt11.ts` (lib `bolt11` npm)
- Extraction de `amountSats`, `network`, `paymentHash`, `expiry`
- Appelé depuis `/api/bitlab/proof` pour `kind=INVOICE` (400 si invalide)

### JWT challenge (anti-replay)
- `src/lib/bitlab/jwt.ts` — `jose` HS256
- `POST /api/bitlab/challenge` émet un JWT contenant
  `{ userId, questCode, kind, nonce, exp (1h) }`
- `POST /api/bitlab/proof` **exige** maintenant ce JWT (`min 16 chars`,
  plus optionnel). Vérification : signature, expiry, nonce consommé via
  Redis `SET NX EX`, correspondance `(userId, questCode, kind)`
- Secret : `BITLAB_JWT_SECRET` (fallback `CSRF_SECRET` en dev)

### Service `LightningClient` (mempool)
- `src/lib/bitlab/lightning.ts`
- `getChannel(scid)` via `mempool.space/api/v1/lightning/channels/{id}`
- Normalisation vers `ChannelInfo` (capacity, status, pubkeys, chan_point)
- Dispatcher `resolveChannel(network, scid)` — voir ci-dessous

### Service `LndClient` (testnet/signet/regtest)
- `src/lib/bitlab/lnd.ts`
- Interroge `GET /v1/graph/edge/{chan_id}` d'un node LND externe
- `scidToChanId(scid)` encode `<block>x<tx>x<vout>` en chan_id uint64
  (BOLT 07)
- `getChannelViaLnd(id, cfg)` via `node:https` avec macaroon header
  (`Grpc-Metadata-macaroon`) et support TLS self-signed
- Configuration par env (voir § *Config LND*)

### Dispatcher Lightning
- `resolveChannel(network, scid)` dans `lightning.ts`
  - `testnet4 | signet | regtest` → LND si configuré, sinon
    `source="unavailable"` (le handler répond 501)
  - autres → mempool.space
  - retourne `{ channel, source: "lnd" | "mempool" | "unavailable" }` —
    la source est persistée dans `payload.source` pour l'audit

### Endpoint `/api/bitlab/proof`
- Auth requise + CSRF conditionnel + rate limit 20/min
- JWT challenge **obligatoire**
- Vérification métier par kind :
  - **TX** : lookup explorateur, exige `confirmed === true` (409 sinon)
  - **BLOCK** : lookup explorateur, enrichit `height` + `tx_count`
  - **INVOICE** : BOLT11 décodé et validé (400 si invalide)
  - **CHANNEL** : `resolveChannel` (LND ou mempool), 501 si réseau
    testnet sans LND, 404 si channel inconnu
  - **ADDRESS** : accepté en l'état (dérivation locale non vérifiable
    côté serveur sans xpub)
- Upsert idempotent sur `(user, quest, kind)`

### Validation
- `bitlabProofSchema` et `bitlabChallengeSchema` dans
  `src/lib/validation/schemas.ts`
- `questCode` kebab-case, enums stricts sur `kind` et `network`
- `payload` libre (chaque kind a ses champs attendus côté handler)
- `challenge` requis (min 16 chars)

### Wiring quête (pilote `tx-basics`)
- Champ `Quest.missionKind = "SIMULATED" | "BITLAB_PROOF"` dans Prisma
- Seed met `tx-basics` en `BITLAB_PROOF` (voir `prisma/seed.ts:47`)
- `/api/quests/[code]/progress` action `mission_submit` branche :
  - `missionKind === "BITLAB_PROOF"` → cherche une `BitLabProof`
    `consumed=false` pour `(user, quest)`, la marque consommée et
    enchaîne les récompenses (XP, sats, badges, bonus streak)
  - `missionKind === "SIMULATED"` → flux historique inchangé

### UI quest-player
- `BitLabProofStep` dans `src/components/bitquest/quest-player.tsx`
- Affiché quand `quest.missionKind === "BITLAB_PROOF"` à l'étape mission
- Champs : txid/hash + sélecteur réseau + lien deep-link vers BitLab
  (`NEXT_PUBLIC_BITLAB_URL`)
- Bouton « Vérifier ma preuve » enchaîne :
  1. `/api/bitlab/challenge` → JWT
  2. `/api/bitlab/proof` → persiste la preuve
  3. `mission_submit` du parent → consomme la preuve, octroie les
     récompenses
- Deep-link bidirectionnel : « Ouvrir dans BitLab » construit l'URL via
  `buildBitlabDeepLink` (voir § *Protocole deep-link*) et navigue en
  même onglet. Au retour avec `?bitlab_result=1`, `parseBitlabReturn`
  pré-remplit le formulaire et nettoie l'URL via `router.replace`.
- `missionKind` exposé dans `QuestState` (listing) et `QuestDetail.quest`
  (détail) + types `src/lib/bitquest/client.ts`
- Helper `toBitlabKind(missionType)` dans `src/lib/bitlab/mission-kinds.ts`
  pour dériver le kind BitLab attendu depuis le missionType de la quête

### Protocole deep-link BitQuest ↔ BitLab
- `src/lib/bitlab/deep-link.ts` — helpers purs (11 tests)

**Sender** (BitQuest → BitLab) : `GET ${NEXT_PUBLIC_BITLAB_URL}?` avec
params :
- `questCode` : code kebab-case de la quête BitQuest
- `kind` : `TX | BLOCK | INVOICE | CHANNEL | ADDRESS`
- `network` : `testnet4 | signet | regtest`
- `returnTo` : URL absolue BitQuest où renvoyer l'apprenant
- *extras* optionnels (ex. `target`, `feeSats`) tirés de `missionConfig`

**Receiver** (BitLab → BitQuest) : redirige vers `${returnTo}?` avec :
- `bitlab_result=1` (flag d'origine, obligatoire)
- `kind`, `network` (échos sender)
- `txid=<hex64>` pour kind=TX, ou `hash=<hex64>` pour kind=BLOCK

BitQuest à la réception :
1. Valide `bitlab_result=1`, `kind` connu, `network` non vide, txid/hash
   bien formé (64 hex, insensible à la casse)
2. Vérifie que `kind` correspond à la quête courante (évite collision
   inter-quêtes)
3. Pré-remplit le formulaire + nettoie l'URL. L'apprenant reste maître
   du clic « Vérifier » (pas d'auto-submit, décision délibérée pour
   maintenir le consentement explicite avant d'engager le JWT challenge)

## Ce qui N'est PAS livré (par choix)

1. **Pas d'audit `AdminAuditLog`** sur `/api/bitlab/proof` : c'est une
   action apprenante, pas une mutation admin.
2. **Pas de UI deep-link callback** dans `mission-panel.tsx` : le bouton
   « Ouvrir dans BitLab » ouvre `NEXT_PUBLIC_BITLAB_URL` en nouvel onglet,
   sans round-trip JWT + callback encore (optionnel, roadmap).
3. **ADDRESS non vérifié** : la dérivation d'une adresse depuis un xpub
   est purement cliente ; aucune lookup serveur actuellement.

## Config LND

Variables d'environnement requises pour activer la vérification CHANNEL
sur testnet/signet/regtest :

```bash
LND_REST_URL=https://my-lnd-node.local:8080
LND_MACAROON_HEX=0201036c6e64...   # readonly.macaroon encodé en hex
# Précédence TLS (une seule à utiliser) :
LND_TLS_CERT_B64=LS0tLS1CRUdJTi...  # tls.cert PEM encodé en base64 (prod)
LND_TLS_INSECURE=1                  # dev uniquement : accepte un cert self-signed
```

Génération des valeurs depuis un node LND :

```bash
# Macaroon → hex
xxd -p -c 1000 ~/.lnd/data/chain/bitcoin/testnet/readonly.macaroon

# Cert TLS → base64 (une seule ligne, portable Docker/CI)
base64 -i ~/.lnd/tls.cert | tr -d '\n'
```

**Précédence TLS** (dans le client) :
1. Si `LND_TLS_CERT_B64` est fourni : le cert est utilisé comme CA pinnée
   (`rejectUnauthorized=true`). Toute autre CA est refusée, même valide
   système.
2. Sinon si `LND_TLS_INSECURE=1` : `rejectUnauthorized=false`. Dev seulement.
3. Sinon : vérification stricte contre la CA system (suffit pour un cert
   signé Let's Encrypt).

Sans `LND_REST_URL` + `LND_MACAROON_HEX`, les preuves `kind=CHANNEL` sur
testnet reçoivent un `501 Not Implemented` avec un message explicatif.

## API — exemples

### Émettre un JWT challenge

```bash
curl -X POST http://localhost:3000/api/bitlab/challenge \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{ "questCode": "tx-basics", "kind": "TX" }'
# → { ok, token, nonce, expiresAt }
```

### Soumettre une preuve de transaction

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

Réponses attendues :
- `200 { ok, proof }` — tx confirmée, preuve persistée
- `409 { error, mempool:true }` — tx en mempool, non encore confirmée
- `404 { error }` — tx introuvable sur les deux explorateurs
- `400 { error }` — txid mal formé, JWT invalide, ou quête inconnue

### Soumettre une preuve de channel Lightning

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

Réponses attendues :
- `200 { ok, proof }` — channel trouvé, `payload.source` indique `lnd`
  ou `mempool`
- `404 { error }` — channel inconnu du node LND / mempool
- `501 { error }` — testnet/signet/regtest sans config LND
- `400 { error }` — scid mal formé ou JWT invalide

## Prochaines étapes (roadmap)

1. **BITLAB_PROOF pour d'autres quêtes** — convertir progressivement
   les quêtes `tx_builder` / `block_explorer` / `lightning_pay` existantes.
2. **Audit log séparé** pour toutes les soumissions de preuve (même
   refusées) pour mesurer les attempts et taux de succès.
3. **Signature HMAC sur le `returnTo`** (optionnel) pour que BitQuest
   puisse refuser les retours non authentiques venant d'un tiers.

## Audit & logs

Chaque preuve acceptée émet un log `[INFO] bitlab-proof · bitlab proof
accepted` avec `{ userId, questCode, kind, network }`. En cas d'échec de
lookup explorateur, le log est `[WARN] mempool · tx lookup failed` (ou
`lightning · channel lookup failed`, ou `lnd · lnd channel lookup failed`)
avec le détail de l'erreur sous-jacente.

Pas d'audit `AdminAuditLog` sur ces endpoints : ce ne sont pas des
mutations admin.
