# Certificates v1 — Format et vérification

> Spécification du format Certificate v1 émis par les instances
> BitQuest. Document pour intégrateurs tiers (portfolios, relays,
> plateformes RH, autres apprenants).
>
> **Version** : 1 · HMAC-SHA256. V2 passera à Schnorr-secp256k1 pour
> permettre la vérification offline (NIP-11 Nostr).

## 1. Qu'est-ce qu'un Certificate BitQuest ?

Un Certificate est la trace **exportable et signée** d'une Attestation.
Une Attestation est elle-même la trace **immuable server-side** d'une
quête Bitcoin complétée par un apprenant.

- **Attestation** : row DB côté BitQuest, créée via event-bus dès que
  `UserQuestProgress.status = COMPLETED`. Unique sur
  `(userId, kind, targetCode)`.
- **Certificate** : blob signé par l'instance BitQuest, téléchargeable
  par l'apprenant. Le même Certificate peut être recréé à l'identique
  (idempotence via la clé composite `(attestationId, format)`).

## 2. Format du blob

Un Certificate v1 est une chaîne ASCII à 3 parties séparées par des
points, chacune en base64url (sans padding) :

```
v1.<payload>.<signature>
```

- `v1` : literal version.
- `<payload>` : JSON canonicalisé puis base64url. Clés niveau 1
  triées lexicographiquement avant stringify.
- `<signature>` : HMAC-SHA256 du `<payload>` (texte base64url, pas
  des octets du JSON), avec `CERT_SIGN_SECRET` côté serveur.

## 3. Payload canonique

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
  "targetTitle": "Le Bloc Genèse",
  "userId": "cm789…",
  "v": 1
}
```

Les clés sont **toujours triées** côté serveur avant la signature, pour
que deux Certificates pour la même attestation produisent exactement
le même blob (déterminisme). Un vérificateur doit donc trier aussi
avant de re-signer s'il vérifie depuis le JSON brut.

**Types** :
- `userId`, `attestationId`, `certificateId` : cuid (string).
- `issuedAt` : ISO 8601 string.
- `kind` : `QUEST | COURSE | BADGE_EARNED` (v1 : seul `QUEST` est émis
  automatiquement par le handler event-bus).
- `metadata` : objet libre, dépend du kind. Pour `QUEST` :
  `{ xpEarned, satsEarned, questCode, issuedAtEpoch }`.
- `v` : literal `1`.

## 4. Vérification

### 4a. Via l'endpoint public

```bash
curl -s "https://bitquest.example.com/api/certificates/verify?blob=v1.XXX.YYY"
```

Réponse :
```json
{
  "ok": true,
  "payload": { /* comme ci-dessus */ }
}
```

- Rate-limit IP 60/60s (LOT 29).
- Content-Type: `application/json` avec headers
  `X-Protocol-Version: 1` + `X-Certificate-Version: 1`.
- Retourne `{ ok: false, error }` + status 400 si signature invalide.

### 4b. Vérification locale (impossible en v1)

En v1, la signature est symétrique (HMAC). Seul le serveur qui
possède `CERT_SIGN_SECRET` peut re-signer et vérifier. C'est
volontairement contraint pour simplifier le rollout — la v2 Schnorr
ouvrira la vérification offline par n'importe quel client qui
connaît la pubkey de l'instance (NIP-11 Nostr style).

## 5. Identifier l'instance BitQuest d'origine

```bash
curl -s https://bitquest.example.com/api/version
```

Retourne :
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

Le champ `issuer` **doit** matcher le champ `issuer` du payload du
Certificate pour que la vérification ait du sens. Si un apprenant
présente un certif émis par `bitquest-rogue.example.com`, ce n'est
pas un Certificate BitQuest officiel.

## 6. Cycle de vie

1. Apprenant complète une quête → event-bus `quest.completed` →
   `createQuestAttestation` crée une Attestation en DB.
2. Apprenant clique « Exporter » sur `/attestations` → POST
   `/api/me/attestations/[id]/certificate` → Certificate row créé
   en DB (format="JSON_V1"), blob signé renvoyé au client.
3. Apprenant télécharge le fichier `.txt` ou copie le lien
   `?blob=...` → partage avec un tiers.
4. Tiers ouvre le lien → page `/verify` affiche le payload décodé +
   badge « Vérifié » emerald.

## 7. Roadmap v2 (préparation NIP-11 Nostr)

- Signature Schnorr-secp256k1 (secp256k1 BIP-340).
- Clé publique de l'instance publiée dans `/.well-known/nostr.json`
  (NIP-11) + champ `pubkey` dans `/api/version`.
- Vérification offline par n'importe quel client qui a la pubkey
  (pas de réseau requis).
- Blob format : `v2.<payload>.<schnorr_sig_hex>`.
- Backward compat : le serveur accepte les deux versions au verify
  (pattern des LOT P0.1/P0.3 côté protocole deep-link).

## 8. Références

- LOT 25 : handler event-bus `createQuestAttestation`
  (`src/lib/handlers/attestations.ts`).
- LOT 28 : signature HMAC + route emit (`src/lib/certificates/sign.ts`,
  `src/app/api/me/attestations/[id]/certificate/route.ts`).
- LOT 29 : route publique verify
  (`src/app/api/certificates/verify/route.ts`).
- LOT 30 : page `/verify` UI (`src/app/verify/page.tsx`).
- LOT 42/43 : headers `X-Protocol-Version` + `X-Certificate-Version`.
- LOT 44 : endpoint `/api/version`.
