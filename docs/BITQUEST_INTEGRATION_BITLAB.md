# Intégration BitQuest ↔ BitLab — 2026-11-09

> Analyse technique de l'intégration entre BitQuest (`./`) et BitLab (`../bitlab/`), basée sur l'exploration du dépôt BitLab (`../bitlab/src/`, `../bitlab/package.json`, `../bitlab/README.md`). **Aucune modification de BitLab n'est proposée dans cette phase d'audit.**

---

## 1. État actuel : rien n'est branché

BitQuest contient 8 types de missions `block_explorer`, `key_forge`, `tx_builder`, `mine_nonce`, `ln_channel`, `ln_invoice`, `multisig_sign`, `taproot_tweak` (`src/lib/bitquest/missions.ts`), **toutes exécutées en simulation serveur**. Le texte UI mentionne "BitLab Sandbox" (`src/components/bitquest/mission-panel.tsx`), mais aucune ligne de code ne contacte le dépôt BitLab :

- Pas d'URL `bitlab.*` dans le code.
- Pas d'écouteur `window.addEventListener("message", ...)` dédié.
- Pas de requête HTTP sortante vers BitLab.
- Pas d'import de `@scure/*`, `@noble/*`, aucune lib Lightning.

**L'intégration doit être conçue et construite à partir de zéro.**

---

## 2. Ce que BitLab offre à BitQuest

Extraits confirmés par lecture directe de `../bitlab/` :

### 2.1 Modèle de sécurité (`../bitlab/README.md:26-33`)
- Clés privées et mnémoniques **uniquement dans le navigateur** (IndexedDB).
- Le backend BitLab est un **proxy en lecture seule** vers `mempool.space` + broadcast de transactions brutes (`../bitlab/src/app/api/bitcoin/route.ts:245-422`).
- Zéro authentification utilisateur BitLab.
- Deux nœuds LDK réels compilés en WASM, exécutés dans un Web Worker.

### 2.2 Routes API exposées par BitLab

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api` | Health check |
| GET | `/api/bitcoin?path=...&network=...` | Proxy Esplora avec allow-list regex |
| POST | `/api/bitcoin?path=tx&network=...` | Broadcast raw tx hex |
| POST | `/api/mine/submit` | Submit Testnet4/Regtest bloc miné |
| GET | `/api/regtest/info` | État regtest embarqué |
| POST | `/api/regtest/faucet` | Faucet regtest |
| POST | `/api/regtest/mine` | Mine N blocs regtest |

**Aucune route BitLab n'est conçue pour produire ou valider une preuve pour un service tiers.** BitLab est aujourd'hui un **client riche autonome**.

### 2.3 Capacités Lightning (`../bitlab/src/lib/lightning.ts`)

- `lnLab.createInvoice(node, amount, desc, expiry)` → BOLT11 signé.
- `lnLab.createOffer(node, amount, desc)` → BOLT12.
- `lnLab.payInvoice(node, bolt11, amount)` → événement `payment_sent` dans le journal.
- **Pas d'exposition WebLN standard** (`window.webln` non implémenté).

---

## 3. Compatibilité technique

| Critère | BitQuest | BitLab | Verdict |
|---|---|---|---|
| Next.js | 16.1.1 | 16.4.3 | ✅ Compatible |
| React | 19.0.0 | 19.3.1 | ✅ Compatible |
| TypeScript | 5.x | 5.9.3 | ✅ |
| Shadcn/ui + Radix | Oui | Oui | ✅ Design system réutilisable |
| Zustand | 5.0.6 | 5.0.16 | ✅ |
| TanStack Query | 5.82 | 5.104 | ✅ |
| Base de données | SQLite (cible Postgres) | Aucune (IndexedDB browser) | ⚠️ Isolement total |
| Authentification | Session custom | Aucune | ⚠️ SSO à concevoir |
| Runtime | Node | Bun ≥ 1.2 | ⚠️ À harmoniser ou documenter |
| Licence | AGPL-3.0 | MIT | ✅ MIT ⊂ AGPL ; BitQuest peut consommer BitLab |

---

## 4. Trois architectures d'intégration possibles

### Option A — iframe + postMessage (MVP rapide)

```
BitQuest ──(ouvre)──> <iframe src="bitlab.io/?mission=...&challenge=JWT">
   ▲                       │
   │                       │ user agit
   │                       │
   └──(postMessage)────────┘  { proof: txid, bolt11, ... }
          │
          ▼
   BitQuest /api/bitlab/proof : vérifie contre mempool.space
```

**Avantages** : zéro changement côté BitLab si on se contente d'un iframe passif + lecture des preuves affichées. Pas de CORS si BitLab active CORS sur les routes concernées.
**Inconvénients** : UX lourde (iframe dans page), parsing des preuves fragile, risque si l'utilisateur dépose la preuve manuellement.

### Option B — Deep-link + JWT challenge/response (recommandé)

```
BitQuest émet un MissionChallenge (JWT signé HS256, expiry 1h) contenant :
  { userId, questCode, missionKind, network, requiredAction, nonce }
         │
         ▼
redirect https://bitlab.gandalnexus.io/?mission=<id>&challenge=<jwt>&returnTo=<url>
         │
BitLab lit le JWT, précharge la bonne UI (tx-builder ou lightning)
         │
user agit : construit tx, ouvre canal, mine bloc, paie invoice
         │
BitLab POST → https://bitquest.gandalnexus.io/api/bitlab/proof
   { challenge: jwt, proof: { kind: "TXID"|"BOLT11"|"BLOCK_HASH", value, network } }
         │
BitQuest vérifie :
  - signature du JWT (non expiré, nonce non consommé)
  - preuve :
      TXID → mempool.space/{network}/api/tx/{txid}, vérifier outputs attendus
      BOLT11 → bibliothèque bolt11-decoder, montant + description
      BLOCK_HASH → mempool.space/{network}/api/block/{hash}
         │
BitQuest marque la quête COMPLETED, journalise dans BitLabProof
```

**Avantages** :
- Aucune clé privée ne traverse les deux apps.
- Validation 100 % serveur côté BitQuest.
- Replay-safe (nonce + expiry).
- Compatible avec déploiements séparés.

**Inconvénients** :
- Nécessite une petite modification côté BitLab (lecture du query param + envoi de la preuve en fin d'action). Changement minime, à discuter avec le mainteneur BitLab.
- Deux redirections pour l'utilisateur (UX à soigner).

**Effort** : ~10 jours-dev, essentiellement côté BitQuest.

### Option C — Monorepo + app shell commun (long terme)

```
/gandalnexus-monorepo
   ├─ apps/bitquest
   ├─ apps/bitlab
   ├─ packages/ui          (shadcn partagé)
   ├─ packages/bitcoin-core (preuves, vérifs)
   └─ packages/auth        (session + JWT)
```

**Avantages** : same-origin possible (`/learn` et `/lab` sur le même domaine), Zustand store partagé, type safety transversale, un seul pipeline CI/CD, économies de code.

**Inconvénients** :
- Refonte lourde, > 3 semaines.
- Couplage fort : un bug dans un package peut bloquer les deux apps.
- Réorganisation des licences (BitLab MIT, BitQuest AGPL-3.0) à documenter.

**Effort** : ~20 jours-dev.

---

## 5. Recommandation

| Horizon | Reco |
|---|---|
| **Court terme** (phase 2-3 roadmap) | Option **B** : deep-link + JWT challenge/response. Permet de livrer une intégration réelle sans compromettre la sécurité, avec un impact minimal sur BitLab. |
| **Long terme** (après mise en prod stable) | Évaluer Option **C** si l'équipe grandit et si on vise une offre GandalNexus unifiée (sidebar commune, navigation fluide). Ne pas précipiter : on perdrait l'indépendance de BitLab (MIT, projet grand-public) si l'on mélange de l'AGPL-3.0 dans son code. |

**Option A (iframe) non recommandée** : fragilité et UX inférieures à l'option B pour un effort équivalent.

---

## 6. Flux fonctionnel cible (option B détaillée)

Exemple : quête `tx-basics` (Anatomie d'une transaction) sur Testnet4.

### 6.1 Étapes

1. **Dans BitQuest** : l'apprenant termine la théorie, passe le quiz à 70 %.
2. Le bouton "Lancer la mission dans BitLab" devient actif. Il déclenche `POST /api/bitlab/challenge` qui renvoie :
   ```json
   {
     "challengeJwt": "eyJ...",
     "deepLinkUrl": "https://bitlab.gandalnexus.io/?mission=tx-basics&challenge=eyJ..."
   }
   ```
3. L'apprenant clique. **Redirection** vers BitLab (nouvel onglet recommandé pour préserver l'état BitQuest).
4. **Dans BitLab** : le query param `mission=tx-basics` active l'onglet tx-builder. Le JWT est lu, affiché en bandeau ("Mission BitQuest : construis une transaction de X sats vers Y"). Le JWT n'est **pas** envoyé au serveur BitLab, seulement affiché à l'utilisateur et stocké en mémoire locale.
5. L'apprenant construit la transaction, la signe (clé en IndexedDB), la broadcast via `POST /api/bitcoin?path=tx&network=testnet4` (service BitLab existant).
6. BitLab reçoit un `txid`. Il POSTe alors vers BitQuest :
   ```http
   POST https://bitquest.gandalnexus.io/api/bitlab/proof
   Content-Type: application/json

   {
     "challenge": "eyJ...",
     "proof": { "kind": "TXID", "value": "abcd1234...", "network": "testnet4" }
   }
   ```
7. **Dans BitQuest** : `/api/bitlab/proof` :
   - Vérifie la signature du JWT.
   - Vérifie que le `nonce` n'a pas déjà été consommé (table `RewardIdempotencyKey`).
   - Fetch `https://mempool.space/testnet4/api/tx/{txid}`.
   - Compare les outputs à l'attendu stocké dans `missionConfig`.
   - Si OK : marque `UserQuestProgress.status = COMPLETED`, attribue XP + sats, journalise un `BitLabProof`, retourne `200 OK`.
8. BitLab affiche "Mission validée !" et propose un `returnTo` vers BitQuest.
9. **Retour BitQuest** : le dashboard reflète la quête complétée, badge éventuel débloqué.

### 6.2 Modèle JWT

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

Signé `HS256` avec un secret stocké uniquement côté BitQuest. BitLab n'a pas besoin de le vérifier, seulement de le transporter.

### 6.3 Vérifications anti-abus

- `jti` unique ; conservé dans `RewardIdempotencyKey` jusqu'à `exp`.
- Rate limit par `userId` (5 tentatives / heure).
- Détection : un même `txid` qui apparaît pour deux users différents → flaguer.
- Timestamp : la tx doit être postérieure au `iat` du challenge (évite de rejouer une ancienne transaction).

---

## 7. Changements minimaux à demander côté BitLab

Pour l'option B, les patchs attendus côté BitLab sont minimaux (ne pas réaliser dans cette phase d'audit) :

1. **Lecture du query param `mission` dans `../bitlab/src/app/page.tsx`** : sélection de l'onglet en fonction (tx-builder, lightning, mineur, etc.).
2. **Lecture du query param `challenge`** : stockage en mémoire, affichage d'un bandeau "Mission BitQuest en cours".
3. **Hook de completion** : lorsqu'une action réussit (tx broadcast, invoice payée, bloc miné), déclencher une fonction `reportProof(proof)` qui POSTe vers l'URL `returnTo` + endpoint `/api/bitlab/proof`.
4. **CORS** : autoriser `Origin: https://bitquest.gandalnexus.io` sur le endpoint retour (ce sera BitQuest qui l'expose, pas BitLab, donc en fait rien à faire côté BitLab si c'est un simple fetch côté client BitLab).

**Effort BitLab estimé** : 2-3 jours. À chiffrer et planifier avec le mainteneur BitLab lors d'une phase ultérieure.

---

## 8. Alternatives sans modification de BitLab

Si BitLab ne peut pas être modifié dans l'immédiat, trois substituts sont possibles côté BitQuest :

1. **Preuve "copier-coller"** : l'apprenant ouvre BitLab seul, réalise l'action, copie le `txid`/`bolt11` et le colle dans BitQuest. Validation serveur identique. UX dégradée mais fonctionnelle.
2. **Garder la simulation serveur** (existant) en phase 1 et faire évoluer BitLab en parallèle. La promesse "learn → practice" devient "learn → practice-simulated". À assumer dans la communication produit.
3. **Un "proxy practice" côté BitQuest** : BitQuest embarque un sous-ensemble minimal de BitLab (ex. juste le mini tx-builder pour une mission) dans une iframe sandboxée, sans attendre BitLab. **Déconseillé** : duplication du code, viole le principe DRY entre les deux apps.

---

## 9. Contraintes de licence

- BitLab : **MIT** (permissive).
- BitQuest : **AGPL-3.0** (copyleft fort).

BitQuest peut **consommer** BitLab sans conflit, à condition que la distribution de BitQuest reste AGPL-3.0 et que le code BitLab consommé soit redistribué sous MIT (préserver l'avis de licence).

À **éviter** : copier du code BitQuest (AGPL) dans BitLab (MIT) — cela "contaminerait" BitLab.
À **éviter** : fusionner le dépôt dans un monorepo sans séparer clairement les packages par licence.

---

## 10. Checklist d'intégration (tickets à ouvrir)

- [ ] `ADR-01 Integration BitLab — Option B retained`
- [ ] `[BitQuest] Model BitLabProof (Prisma migration)`
- [ ] `[BitQuest] Model RewardIdempotencyKey (Prisma migration)`
- [ ] `[BitQuest] Service MempoolClient (fetch mempool.space, timeout, retries)`
- [ ] `[BitQuest] Lib bolt11-decoder vérifiée (choisir paquet maintenu, audit sec)`
- [ ] `[BitQuest] POST /api/bitlab/challenge (issue JWT)`
- [ ] `[BitQuest] POST /api/bitlab/proof (verify + reward)`
- [ ] `[BitQuest] UI bouton deep-link dans mission-panel.tsx`
- [ ] `[BitQuest] JWT secret rotation policy documentée`
- [ ] `[BitLab] (ultérieurement) Lecture query param + bandeau mission + reportProof hook`
- [ ] `[Doc] Guide apprenant : "Comment valider une mission dans BitLab"`
- [ ] `[Sec] Pentest du flux challenge/proof`

---

## 11. Risques et mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Un `txid` existant mais qui ne correspond pas à l'exercice | Fraude XP/sats | Comparer outputs / montants au challenge |
| Challenge volé via log/URL | Replay potentiel | Nonce + idempotency key + expiry court |
| `mempool.space` indisponible | Blocage des validations | Timeout, fallback vers un second explorateur (blockstream.info), queue de vérification async |
| BitLab modifié par un contributeur et casse le hook | Rupture silencieuse de l'intégration | Tests contract côté BitQuest (mock de la preuve attendue), monitoring du taux de preuves valides |
| Licence AGPL-3.0 "contamine" BitLab | Perte d'adoption BitLab | Garder les repos séparés, ne jamais importer de code AGPL dans BitLab |
| Lightning testnet instable | Missions LN bloquées | Prévoir des missions Testnet3 **et** Regtest (BitLab gère les deux) |

---

**Rédigé le** : 2026-11-09
**Prochain livrable** : `BITQUEST_ROADMAP.md`
