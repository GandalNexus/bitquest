"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale, normalizeLocale } from "./config";
import { translate } from "./dictionaries";

/* ============================================================
 * Provider i18n côté client — persistance par cookie readable.
 *
 * - useT() retourne une fonction `t(key)` toujours stable (sans
 *   recréation) pour éviter les re-renders inutiles.
 * - setLocale() écrit le cookie ET met à jour l'état local.
 * - Hydratation : la locale initiale est passée depuis le serveur
 *   via `initial`, sinon on tente de lire le cookie côté client.
 * ============================================================ */

interface LocaleContextValue {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

/**
 * Remplace les `{var}` par leur valeur. Simple et sûr (pas d'eval).
 * Si `vars` est absent, renvoie le string inchangé.
 */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const prefix = `${LOCALE_COOKIE}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return normalizeLocale(decodeURIComponent(trimmed.slice(prefix.length)));
    }
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Locale;
}) {
  // Résolution unique de la locale initiale : soit la valeur fournie par
  // le Server Component parent (cas nominal), soit lecture du cookie côté
  // client, soit DEFAULT_LOCALE. Pas d'useEffect — évite les re-renders
  // cascadants et le flash de contenu dans la mauvaise langue.
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initial) return initial;
    if (typeof document !== "undefined") return readLocaleCookie();
    return DEFAULT_LOCALE;
  });

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    if (typeof document !== "undefined") {
      // 1 an, SameSite=Lax, pas HttpOnly (lisible côté JS)
      const maxAge = 60 * 60 * 24 * 365;
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(
        next,
      )}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
    }
  };

  const t = (key: string, vars?: Record<string, string | number>) =>
    interpolate(translate(locale, key), vars);

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fallback utile : composants rendus hors provider → locale par défaut
    return {
      locale: DEFAULT_LOCALE,
      t: (key, vars) => interpolate(translate(DEFAULT_LOCALE, key), vars),
      setLocale: () => {},
    };
  }
  return ctx;
}

/** Hook ergonomique : `const t = useT(); t("dashboard.greeting", { name: "Alice" })`. */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  return useLocale().t;
}
