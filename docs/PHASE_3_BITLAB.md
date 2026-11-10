# Phase 3 — BitLab Integration (foundation)

**Date** : 2026-11-10
**Statut** : fondation posée — câblage quête-par-quête à venir.

## Ce qui est livré

### Modèle de données
- `BitLabProof` : preuve persistée par `(userId, questCode, kind)`
- 5 kinds : `TX | BLOCK | INVOICE | CHANNEL | ADDRESS`
- 3 réseaux : `testnet4 | signet | regtest` (mainnet explicitement refusé)
- Flag `consumed` pour tracer si la preuve a déjà donné lieu à récompense

### Service `MempoolClient`
- `src/lib/bitlab/mempool.ts`
- `getTransaction(network, txid)` et `getBlock(network, hash)`
- Fallback automatique `mempool.space` → `blockstream.info`
- Timeout 5s + `AbortController`
- Logs structurés via `logger("mempool")`

### Endpoint public
- `POST /api/bitlab/proof`
- Auth requise + CSRF conditionnel + rate limit 20/min
- Vérification métier :
  - **TX** : lookup explorateur, exige `confirmed === true` (409 sinon)
  - **BLOCK** : lookup explorateur, enrichit `height` + `tx_count`
  - **INVOICE / CHANNEL / ADDRESS** : acceptés tel quel (parseurs BOLT11 /
    LND à venir)
- Upsert idempotent sur `(user, quest, kind)`

### Validation
- `bitlabProofSchema` dans `src/lib/validation/schemas.ts`
- `questCode` kebab-case, enums stricts sur `kind` et `network`
- `payload` libre (chaque kind a ses champs attendus côté handler)

## Ce qui N'est PAS livré (par choix)

1. **Pas de wiring quête**. Aucune quête du seed actuel n'exige une
   `BitLabProof` pour passer en `COMPLETED`. La bascule quête-par-quête
   viendra dans un sprint ultérieur, en commençant probablement par
   `tx-basics`.
2. **Pas de BOLT11 decoder** encore. L'invoice est acceptée mais non
   validée (montant / expiry / description hash). Ajouter la lib
   `bolt11` + validation métier.
3. **Pas de JWT challenge/proof**. L'architecture roadmap (Phase 3.4)
   prévoit `POST /api/bitlab/challenge` qui émet un JWT signé HS256, puis
   `/api/bitlab/proof` consomme le nonce. Pour la foundation, l'endpoint
   est stateless — anti-replay via `(userId, questCode, kind)` unique.
4. **Pas de reward award automatique**. Le flag `consumed=false` existe
   mais aucun code ne le passe à `true`. Un futur hook dans
   `progression.ts` consommera la preuve quand la quête passera COMPLETED.
5. **Pas d'UI deep-link** dans `mission-panel.tsx` (bouton « Ouvrir dans
   BitLab »). Reportée à un sprint UX dédié.

## API — exemples

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
    "payload": { "txid": "aabbcc...00" }
  }'
```

Réponses attendues :
- `200 { ok, proof }` — tx confirmée, preuve persistée
- `409 { error, mempool:true }` — tx en mempool, non encore confirmée
- `404 { error }` — tx introuvable sur les deux explorateurs
- `400 { error }` — txid mal formé ou quête inconnue

### Soumettre une preuve de bloc

```bash
curl -X POST http://localhost:3000/api/bitlab/proof \
  -b cookies.txt \
  -H "X-CSRF-Token: $CSRF" \
  -d '{
    "questCode": "mine-nonce",
    "kind": "BLOCK",
    "network": "testnet4",
    "payload": { "hash": "000000...ef" }
  }'
```

## Prochaines étapes

1. Décoder BOLT11 (lib `bolt11` npm) + valider montant/expiry.
2. Service `LightningClient` pour vérifier CHANNEL via LND.
3. JWT challenge/proof flow (anti-replay stateful serveur).
4. UI mission-panel : bouton « Ouvrir dans BitLab » qui deep-link vers
   `bitlab.example/mission?questCode=...&callback=...`.
5. Wiring quête-par-quête : champ `Quest.missionKind = "SIMULATED" |
   "BITLAB_PROOF"`, et handler `/api/quests/[code]/progress` qui
   consomme une `BitLabProof` non-consumed quand le mission-type l'exige.
6. Pilote : convertir `tx-basics` en `BITLAB_PROOF`.

## Audit & logs

Chaque preuve acceptée émet un log `[INFO] bitlab-proof · bitlab proof
accepted` avec `{ userId, questCode, kind, network }`. En cas d'échec
de lookup explorateur, le log est `[WARN] mempool · tx lookup failed`
avec le détail de l'erreur sous-jacente.

Pas d'audit `AdminAuditLog` sur cet endpoint : ce n'est pas une mutation
admin mais une action apprenante.
