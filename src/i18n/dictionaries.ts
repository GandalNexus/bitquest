import fr from "./messages/fr.json";
import en from "./messages/en.json";
import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Dictionnaires statiques : résolution O(1) côté client ET côté serveur,
 * sans fetch ni async. Les deux fichiers sont bundlés ensemble (petits, ~1 KB
 * chacun pour le moment) ; l'économie du code-split viendra si les dicos
 * grossissent au-delà de ~50 KB.
 */
const DICTIONARIES: Record<Locale, Record<string, string>> = { fr, en };

/** Dictionnaire pour une locale. */
export function dictionary(locale: Locale): Record<string, string> {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** Traduction d'une clé avec fallback sur la locale par défaut puis la clé elle-même. */
export function translate(locale: Locale, key: string): string {
  const d = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  return d[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
}
