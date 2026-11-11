# Docker LND (testnet via neutrino)

Guide pour lancer un node Lightning Network Daemon dans l'environnement de
dev BitQuest, afin de tester la vérification de preuve `kind=CHANNEL` sur
testnet end-to-end.

**Backend** : neutrino (pas de bitcoind local requis — sync par SPV).
**Réseau** : testnet (bitcoin testnet3 pour l'instant côté LND, pas testnet4).
**Public cible** : développeurs qui veulent exercer la boucle Phase 3 BitLab
complète sans dépendre d'un node externe.

> ⚠️ **Dev uniquement.** Le password de wallet et la seed utilisés ne sont
> pas production-safe. L'infra proposée est opt-in via un profile Docker
> et n'est pas démarrée par défaut.

## Démarrer le container LND

Le service est défini dans `docker-compose.dev.yml` sous le profile `lnd`.
Il n'est **pas démarré** par un `docker compose up` standard.

```bash
docker compose -f docker-compose.dev.yml --profile lnd up -d lnd
```

Vérifie que le container tourne :

```bash
docker ps --filter name=bitquest-lnd
docker logs -f bitquest-lnd   # suivi des logs de sync testnet
```

Le sync initial via neutrino prend **10-30 min** selon la connexion (le
filtre de blocs testnet est léger, pas de téléchargement complet). Le
container est utilisable dès que `tls.cert` est généré, mais les requêtes
graph ne retourneront des résultats qu'après la sync.

## Initialiser le wallet (one-time)

LND démarre sans wallet : `GET /v1/getinfo` renvoie 404 tant qu'un wallet
n'est pas créé et déverrouillé. Le script suivant automatise la création
(idempotent — s'arrête si le wallet existe déjà).

```bash
bash scripts/lnd/init-wallet.sh
```

Il appelle l'API REST `POST /v1/genseed` puis `POST /v1/initwallet` avec
un cipher seed généré par LND et le password par défaut
`bitquest-dev-password-insecure`. Pour utiliser un password custom :

```bash
LND_WALLET_PASSWORD=mon-mot-de-passe bash scripts/lnd/init-wallet.sh
```

Après succès, `admin.macaroon` + `readonly.macaroon` sont générés dans
`/root/.lnd/data/chain/bitcoin/testnet/` (visibles via le volume Docker
`bitquest_lnd_data`).

## Extraire les credentials pour BitQuest

```bash
bash scripts/lnd/extract-creds.sh
```

Affiche quelque chose comme :

```
# --- LND credentials (générés 2026-11-11T01:30:00Z) ---
LND_REST_URL=https://bitquest-lnd:8080
LND_MACAROON_HEX=0201036c6e64...
LND_TLS_CERT_B64=LS0tLS1CRUdJTi...
# ------------------------------------------------------------------
```

Copie ces trois lignes dans un `.env` ou `.env.local` à la racine du
projet, puis redémarre `bitquest-dev` pour que Next.js relise les env :

```bash
docker compose -f docker-compose.dev.yml restart bitquest-dev
```

**Note sur le hostname** : `bitquest-lnd` est résolu via le réseau Docker
compose interne (le container `bitquest-dev` et `bitquest-lnd` partagent
le même network). Depuis l'hôte Mac, l'URL serait `https://localhost:8081`
(port mappé). `extract-creds.sh` utilise `LND_HOSTNAME=bitquest-lnd` par
défaut ; pour l'hôte : `LND_HOSTNAME=localhost LND_PORT=8081 bash
scripts/lnd/extract-creds.sh`.

## Vérifier l'intégration

Avec le wallet initialisé et les env chargées côté BitQuest :

```bash
# 1. Status LND
docker exec bitquest-lnd lncli --network=testnet getinfo

# 2. Status BitQuest (health admin)
curl http://localhost:3000/api/health | jq

# 3. Test d'un lookup de channel (une fois testnet partiellement synced) :
#    les bons scid testnet sont rares, utilise un chan_id connu ou attends
#    d'avoir une preuve réelle à soumettre.
```

Le flux end-to-end :
1. Apprenant ouvre une quête `ln_channel` (actuellement `lightning` est
   encore `SIMULATED`, à migrer une fois LND stable).
2. BitLabProofStep appelle `/api/bitlab/challenge` → JWT.
3. BitLabProofStep appelle `/api/bitlab/proof` avec `kind=CHANNEL`.
4. Handler route `resolveChannel(network, scid)` → dispatcher LND.
5. `getChannelViaLnd` interroge `GET /v1/graph/edge/{chanId}` via REST
   avec le macaroon hex en header `Grpc-Metadata-macaroon`, cert pinné
   via `LND_TLS_CERT_B64`.
6. Résultat normalisé en `ChannelInfo`, persisté en `BitLabProof`.

## Reset complet

Si tu veux repartir de zéro (nouveau wallet, etc.) :

```bash
docker compose -f docker-compose.dev.yml --profile lnd down
docker volume rm bitquest_lnd_data   # ⚠️ efface wallet + chain state
docker compose -f docker-compose.dev.yml --profile lnd up -d lnd
bash scripts/lnd/init-wallet.sh
bash scripts/lnd/extract-creds.sh
```

## Dépannage

- **`init-wallet.sh` échoue avec une erreur TLS** : `tls.cert` n'est pas
  encore généré ou le container vient de démarrer. Attends 10-20 s et
  relance.
- **`/v1/getinfo` renvoie `server is still in the process of starting`** :
  neutrino est en train de sync. Attends ou check les logs.
- **Macaroon hex copié mais BitQuest refuse les requêtes (401)** : le
  macaroon doit être `readonly.macaroon` (ou `admin.macaroon`), pas
  `invoice.macaroon`. `extract-creds.sh` prend readonly par défaut.
- **TLS error depuis bitquest-dev** : le cert est généré pour
  `localhost` + `bitquest-lnd` (grâce à `--tlsextradomain`). Si tu
  changes le hostname, pense à régénérer le cert (`rm tls.*` dans le
  container puis redémarre lnd).
