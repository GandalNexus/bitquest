/**
 * Instrumentation Next.js — point d'entrée unifié server + edge.
 *
 * Remplace les 3 fichiers legacy `sentry.*.config.ts` par le pattern
 * recommandé en Next.js 15+ : le hook `register()` est appelé une
 * fois par runtime (nodejs | edge). Le client reste dans
 * `sentry.client.config.ts` qui est chargé par le plugin webpack
 * Sentry côté bundle navigateur.
 *
 * Variables d'env :
 *   - SENTRY_DSN             : DSN côté serveur / edge (jamais exposé client).
 *   - SENTRY_TRACES_SAMPLE_RATE : taux de sampling tracing (0.0–1.0, défaut 0.1).
 *   - NEXT_PUBLIC_SENTRY_DSN : DSN côté navigateur (bundlé).
 *
 * Si le DSN est absent, Sentry reste silencieux (dev local). Pas d'init
 * partielle — Sentry.init(undefined) est no-op.
 */
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Handlers event-bus : brancher au boot node pour que les
    // évènements (quest.completed, etc.) soient consommés dès le
    // premier request.
    const { registerAttestationHandlers } = await import(
      "./src/lib/handlers/attestations"
    );
    registerAttestationHandlers();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Capture les erreurs non gérées levées pendant le rendering des RSC
 * et des Route Handlers. Sentry l'exporte ; on le réexpose ici comme
 * prévu par le contrat Next.js.
 */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
