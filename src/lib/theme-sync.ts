/**
 * Synchronisation du thème entre BitQuest et BitLab via query param
 * `?theme=dark|light`.
 *
 * Les deux apps tournent sur des origins différents (localhost:3000 vs 3001
 * en dev, domaines distincts en prod), donc leur localStorage est cloisonné.
 * Pour éviter l'effet « flash de thème différent » quand l'utilisateur
 * navigue entre les deux, on propage l'état courant dans l'URL.
 */
"use client";

import { useTheme } from "next-themes";

export type ThemeHint = "dark" | "light";

/**
 * Hook : retourne une fonction `withTheme(url)` qui append `?theme=` courant
 * à une URL cross-origin. Fallback sur `"dark"` tant que next-themes n'a
 * pas résolu (pré-hydratation SSR).
 */
export function useAppendTheme(): (url: string) => string {
  const { resolvedTheme } = useTheme();
  const theme: ThemeHint = resolvedTheme === "light" ? "light" : "dark";
  return (url: string) => appendThemeToUrl(url, theme);
}

/**
 * ⚠️ `new URL(absolute)` est appelé sans base pour produire une sortie
 * identique SSR/client (évite un mismatch d'hydratation : `new URL` normalise
 * `http://host:3000` en `http://host:3000/`, le fallback string ne le fait pas).
 */
export function appendThemeToUrl(url: string, theme: ThemeHint): string {
  try {
    const u = new URL(url);
    u.searchParams.set("theme", theme);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}theme=${theme}`;
  }
}

export function readThemeFromQuery(search: string): ThemeHint | null {
  try {
    const params = new URLSearchParams(search);
    const v = params.get("theme");
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Retire le param `theme` de l'URL affichée (sans navigation) après
 * application. Évite la pollution visuelle et les partages d'URL qui
 * figeraient le thème.
 */
export function stripThemeFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("theme")) return;
    url.searchParams.delete("theme");
    const qs = url.searchParams.toString();
    const newUrl = url.pathname + (qs ? `?${qs}` : "") + url.hash;
    window.history.replaceState(window.history.state, "", newUrl);
  } catch {
    // ignore
  }
}
