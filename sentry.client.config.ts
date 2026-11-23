// Configuration Sentry côté navigateur.
// NEXT_PUBLIC_SENTRY_DSN est exposé au bundle client — ne pas confondre
// avec SENTRY_DSN (server-only).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn && dsn.length > 0) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.NEXT_PUBLIC_APP_VERSION ?? undefined,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    // Pas de replays par défaut — requiert explicitement une opt-in.
  });
}
