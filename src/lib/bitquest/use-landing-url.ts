"use client";

import { useEffect, useState } from "react";

const FALLBACK = "https://gandalnexus.com";
const CACHE_KEY = "bq-landing-url-v1";
// Session cache : on évite de re-taper l'API à chaque remount de la nav.
// 10 minutes de TTL — admin peut forcer un hard reload si besoin.
const TTL_MS = 10 * 60 * 1000;

interface CachedEntry {
  url: string;
  at: number;
}

/**
 * Hook client qui résout l'URL de la landing publique (bouton « Nexus »
 * en header). Admin-configurable via `LandingConfig.landingUrl` côté
 * BitQuest, servi par `/api/public/landing-config`.
 *
 * Ordre de résolution :
 *   1. `sessionStorage` cache (< 10 min)
 *   2. fetch depuis `/api/public/landing-config`
 *   3. fallback `FALLBACK` constant (gandalnexus.com)
 *
 * Volontairement un fetch léger : la route est CORS-ouverte + Next
 * revalidate 60 s + cache-control 60 s. L'instance qui consomme (même
 * BitQuest, donc same-origin) ne paye ~0 ms.
 *
 * Garanties :
 *   - SSR-safe : retourne le fallback au premier render pour éviter
 *     les mismatch d'hydratation. Le fetch arrive post-mount.
 *   - No-flicker sur la nav côté user : au prochain remount dans la
 *     même session, le cache évite le fetch.
 */
export function useLandingUrl(): string {
  const [url, setUrl] = useState<string>(FALLBACK);

  useEffect(() => {
    // Cache session hit
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as CachedEntry;
        if (
          cached &&
          typeof cached.url === "string" &&
          typeof cached.at === "number" &&
          Date.now() - cached.at < TTL_MS
        ) {
          if (cached.url !== url) setUrl(cached.url);
          return;
        }
      }
    } catch {
      // storage inaccessible (private mode) → fetch de toute façon
    }

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 4000);
    fetch("/api/public/landing-config", {
      method: "GET",
      signal: ac.signal,
      credentials: "omit",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: { landingUrl?: unknown } | null) => {
        if (!cfg) return;
        const next = typeof cfg.landingUrl === "string" ? cfg.landingUrl : null;
        if (!next || !isHttpUrl(next)) return;
        setUrl(next);
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ url: next, at: Date.now() } satisfies CachedEntry),
          );
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Silence : garder le fallback courant
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      ac.abort();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return url;
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
