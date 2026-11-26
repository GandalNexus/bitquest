# Sentry — ops guide (Phase 5)

## Overview

BitQuest is instrumented with `@sentry/nextjs`. The integration is
**opt-in**: with no DSN configured, all Sentry code is no-op and
adds zero overhead (neither in performance nor network calls).

Three instrumented surfaces:

- **Client** (`sentry.client.config.ts`) — browser JS errors.
- **Server** (`sentry.server.config.ts`) — Node runtime errors.
- **Edge** (`sentry.edge.config.ts`) — middleware/edge function errors.

An application wrapper (`src/lib/obs/sentry.ts`) exposes
`captureException()` and `captureMessage()`. The pino logger
(`src/lib/log.ts`) automatically calls `captureException` on any
`log.error({ err }, …)`. Business code therefore **never** needs to import
Sentry directly.

## Production Activation

### 1. Create a Sentry project

On sentry.io → New Project → "Next.js" platform. Name the project
`bitquest-prod` (and separate `bitquest-staging` if two environments).

### 2. Retrieve the DSN

In Settings → Projects → bitquest-prod → Client Keys. The DSN has the
form:

```
https://<public_key>@<orgid>.ingest.sentry.io/<project_id>
```

### 3. Configure environment variables

**Production (server)**:

```bash
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
# Release taken from npm_package_version (package.json → version).
SENTRY_TRACES_SAMPLE_RATE=0.1   # 10% of transactions sampled
```

**Production (client)** — these vars start with `NEXT_PUBLIC_` so
they're injected into the browser bundle:

```bash
NEXT_PUBLIC_SENTRY_DSN=$SENTRY_DSN
NEXT_PUBLIC_APP_VERSION=v0.4.0   # release grouping on client side
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

`NODE_ENV` automatically drives the `environment` field (production /
development / test). No need for a separate `SENTRY_ENV` variable.

> The public DSN **can** be exposed in the bundle — it's by Sentry
> design (the DSN is not a secret, just a project identifier).
> But NEVER expose a CI integration Auth Token on the client side.

### 4. Verify Sentry reports

After deployment, trigger a controlled error:

```ts
// From a test route accessible only to ADMIN:
captureException(new Error("Sentry smoke test"));
```

The Sentry project should display the error within 30 seconds. If
nothing appears, check:

- `SENTRY_DSN` properly defined in the server process env.
- The domain is not blocked by an ad blocker / CSP.
- Server logs don't mention a Sentry error at startup.

## Anonymization (GDPR)

The three configs have a `beforeSend` that scrubs:

- Entire `event.request.cookies` → removed.
- `Authorization`, `Cookie`, `x-gn-token` headers → removed.

The pino logger (`src/lib/log.ts`) also scrubs its own sensitive
fields via its redact list. If you add a new sensitive field
(token, hash, seed), extend pino's `redact` **before** deploying.

## Recommended Dashboards

Create on Sentry:

- **Alert: errors > 10/min** — Slack webhook on `#bitquest-alerts` channel.
- **Issue filter: environment:production tag:scope** — each `logger("scope")`
  automatically attaches this tag (via internal enrichment of the wrapper).
- **Performance → BitLab proof flow** — transactions named
  `POST /api/bitlab/proof` and `POST /api/bitlab/challenge`. Target
  p95 < 400ms, p99 < 1.5s.

## Disabling Sentry

To cleanly disable (e.g. switch to "canary without alerting" mode):

```bash
unset SENTRY_DSN
unset NEXT_PUBLIC_SENTRY_DSN
```

The 3 configs see an empty `dsn` → don't init → the `captureException`
wrappers remain no-op. No rebuild required.

## Known Limitations

- No auto-uploaded source maps (requires `withSentryConfig` in
  `next.config.ts` + CI `SENTRY_AUTH_TOKEN`). Deferred: to do when
  we have a stable CI that builds in prod.
- No Replay integration (anti-GDPR too sensitive for now).
- `tracesSampleRate` at 0.1 by default → adjust according to real
  volume once in prod.
