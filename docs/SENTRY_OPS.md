# Sentry — guide ops (Phase 5)

## Vue d'ensemble

BitQuest est instrumenté avec `@sentry/nextjs`. L'intégration est
**opt-in** : sans DSN configuré, tout le code Sentry est no-op et
n'ajoute aucun overhead (ni en performance ni en appels réseau).

Trois surfaces instrumentées :

- **Client** (`sentry.client.config.ts`) — erreurs JS navigateur.
- **Server** (`sentry.server.config.ts`) — erreurs Node runtime.
- **Edge** (`sentry.edge.config.ts`) — erreurs middleware/edge functions.

Un wrapper applicatif (`src/lib/obs/sentry.ts`) expose
`captureException()` et `captureMessage()`. Le logger pino
(`src/lib/log.ts`) appelle automatiquement `captureException` sur tout
`log.error({ err }, …)`. Le code métier n'a donc **jamais** à importer
Sentry directement.

## Activation en production

### 1. Créer un projet Sentry

Sur sentry.io → New Project → platform "Next.js". Nommer le projet
`bitquest-prod` (et `bitquest-staging` séparé si deux environnements).

### 2. Récupérer le DSN

Dans Settings → Projects → bitquest-prod → Client Keys. Le DSN a la
forme :

```
https://<public_key>@<orgid>.ingest.sentry.io/<project_id>
```

### 3. Configurer les variables d'environnement

**Production (serveur)** :

```bash
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
# Release pris via npm_package_version (package.json → version).
SENTRY_TRACES_SAMPLE_RATE=0.1   # 10% des transactions échantillonnées
```

**Production (client)** — ces vars commencent par `NEXT_PUBLIC_` donc
sont injectées dans le bundle navigateur :

```bash
NEXT_PUBLIC_SENTRY_DSN=$SENTRY_DSN
NEXT_PUBLIC_APP_VERSION=v0.4.0   # grouping release côté client
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

`NODE_ENV` pilote automatiquement le champ `environment` (production /
development / test). Pas besoin de variable `SENTRY_ENV` séparée.

> ⚠️ Le DSN public **peut** être exposé dans le bundle — c'est prévu
> par design Sentry (le DSN n'est pas un secret, juste un identifiant
> de projet). Mais ne JAMAIS exposer de clé Auth Token d'intégration
> CI côté client.

### 4. Vérifier que Sentry remonte

Après déploiement, déclencher une erreur contrôlée :

```ts
// Depuis une route test accessible uniquement aux ADMIN :
captureException(new Error("Sentry smoke test"));
```

Le projet Sentry doit afficher l'erreur dans les 30 secondes. Si
rien n'apparaît, vérifier :

- `SENTRY_DSN` bien défini dans l'env du process serveur.
- Le domaine n'est pas bloqué par un ad blocker / CSP.
- Les logs du serveur ne mentionnent pas d'erreur Sentry au démarrage.

## Anonymisation (RGPD)

Les trois configs ont un `beforeSend` qui scrub :

- `event.request.cookies` entier → supprimé.
- Headers `Authorization`, `Cookie`, `x-gn-token` → supprimés.

Le logger pino (`src/lib/log.ts`) scrub aussi ses propres champs
sensibles via sa redact list. Si tu ajoutes un nouveau champ sensible
(token, hash, seed), étends le `redact` de pino **avant** de déployer.

## Dashboards recommandés

Créer sur Sentry :

- **Alert : erreurs > 10/min** — Slack webhook sur canal `#bitquest-alerts`.
- **Issue filter : environment:production tag:scope** — chaque `logger("scope")`
  attache automatiquement ce tag (via l'enrichissement interne du wrapper).
- **Performance → BitLab proof flow** — transactions nommées
  `POST /api/bitlab/proof` et `POST /api/bitlab/challenge`. Objectif
  p95 < 400ms, p99 < 1.5s.

## Désactiver Sentry

Pour désactiver proprement (ex : passer en mode "canari sans alerting") :

```bash
unset SENTRY_DSN
unset NEXT_PUBLIC_SENTRY_DSN
```

Les 3 configs voient `dsn` vide → ne font pas d'init → les wrappers
`captureException` restent no-op. Aucun rebuild nécessaire.

## Limites connues

- Pas de source maps auto-uploadées (nécessite `withSentryConfig` dans
  `next.config.ts` + `SENTRY_AUTH_TOKEN` CI). Reporté : à faire quand
  on a un CI stable qui build en prod.
- Pas d'intégration Replay (anti-RGPD trop sensible pour l'instant).
- `tracesSampleRate` à 0.1 en défaut → ajuster selon la volumétrie
  réelle une fois en prod.
