/**
 * Thin wrapper autour de @sentry/nextjs — Phase Sentry.
 *
 * Objectif : exposer une API minuscule et stable pour le code applicatif,
 * et surtout **no-op proprement** quand SENTRY_DSN n'est pas défini
 * (environnement de dev courant, CI sans secrets, tests). Le code métier
 * n'a pas à savoir si Sentry est configuré ou pas.
 */
import * as Sentry from "@sentry/nextjs";

export const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN);

/** Capture une exception, no-op si Sentry n'est pas configuré. */
export function captureException(err: unknown, context: Record<string, unknown> = {}): void {
  if (!sentryEnabled) return;
  try {
    Sentry.captureException(err, { extra: context });
  } catch {
    // Silence toute erreur interne de Sentry pour ne jamais casser un code path appelant.
  }
}

/** Message informatif — utile pour tracer un état sans être une erreur. */
export function captureMessage(message: string, context: Record<string, unknown> = {}): void {
  if (!sentryEnabled) return;
  try {
    Sentry.captureMessage(message, { level: "info", extra: context });
  } catch {
    /* silent */
  }
}
