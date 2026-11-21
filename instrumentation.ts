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
    // Validation env — fail-closed en prod/preprod si secrets manquants
    // ou configuration permissive (wildcard CORS, Redis facultatif).
    const { validateOrThrow } = await import("./src/lib/config/env-validator");
    const { logger } = await import("./src/lib/log");
    validateOrThrow(logger("env-validator"));

    await import("./sentry.server.config");
    // Handlers event-bus : brancher au boot node pour que les
    // évènements (quest.completed, etc.) soient consommés dès le
    // premier request.
    const { registerAttestationHandlers } = await import(
      "./src/lib/handlers/attestations"
    );
    registerAttestationHandlers();
    // Scheduler IA : tick toutes les 15 min en interne. Les cadences
    // réelles par type sont dans la table AIGenerationConfig ; ce
    // tick lit la table et génère uniquement ce qui est dû.
    // Désactivable via AI_SCHEDULER_INTERNAL=0 pour les setups où un
    // cron externe (Vercel Cron, k8s CronJob) appelle /api/admin/ai/cron-tick.
    if (process.env.AI_SCHEDULER_INTERNAL !== "0") {
      const { startInternalScheduler } = await import("./src/lib/ai/internal-scheduler");
      startInternalScheduler();
    }
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
