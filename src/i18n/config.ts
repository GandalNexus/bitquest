/**
 * Config i18n — Phase 2.9 foundation.
 *
 * Architecture minimale sans plugin next-intl (ni router rewrite) :
 *   - LOCALES : les deux locales supportées
 *   - LOCALE_COOKIE : persistance du choix côté client
 *   - DEFAULT_LOCALE : fr (public francophone cible)
 *
 * La migration complète des composants vers next-intl / router rewrites
 * viendra dans une étape successive — l'objectif ici est de poser les
 * fondations sans casser l'existant.
 */
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "bq_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
