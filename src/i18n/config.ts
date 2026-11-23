/**
 * Config i18n — Phase 2.9 foundation + extension Wolof (Phase 5.4).
 *
 * Architecture minimale sans plugin next-intl (ni router rewrite) :
 *   - LOCALES : locales supportées. "wo" est un squelette : la plupart
 *     des clés tombent en fallback FR via translate() tant que le
 *     fichier messages/wo.json n'est pas complété par un locuteur.
 *   - LOCALE_COOKIE : persistance du choix côté client
 *   - DEFAULT_LOCALE : fr (public francophone cible, backbone du fallback)
 *
 * Voir docs/I18N_WOLOF.md pour contribuer aux traductions Wolof.
 */
export const LOCALES = ["fr", "en", "wo"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "bq_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
