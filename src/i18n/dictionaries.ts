import fr from "./messages/fr.json";
import en from "./messages/en.json";
import wo from "./messages/wo.json";
import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Dictionnaires statiques : résolution O(1) côté client ET côté serveur,
 * sans fetch ni async. Les fichiers sont bundlés ensemble ; le code-split
 * viendra si les dicos grossissent au-delà de ~50 KB chacun.
 *
 * `wo.json` est volontairement incomplet (squelette à remplir par un
 * contributeur locuteur) ; les clés absentes tombent en fallback FR via
 * `translate()`. Voir docs/I18N_WOLOF.md.
 */
const DICTIONARIES: Record<Locale, Record<string, string>> = { fr, en, wo };

/** Dictionnaire pour une locale. */
export function dictionary(locale: Locale): Record<string, string> {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Traduction d'une clé avec fallback sur la locale par défaut puis sur
 * la clé elle-même. Une valeur vide "" dans un dictionnaire est aussi
 * traitée comme absente pour permettre à un locuteur de pousser un
 * fichier partiel avec les clés vides sans modifier la liste.
 */
export function translate(locale: Locale, key: string): string {
  const d = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const localized = d[key];
  if (localized && localized.length > 0) return localized;
  return DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
}
