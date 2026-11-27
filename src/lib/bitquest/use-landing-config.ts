"use client";

import { useEffect, useState } from "react";

const CACHE_KEY = "bq-landing-cfg-v1";
const TTL_MS = 10 * 60 * 1000;

export interface LandingConfigPublic {
  bitquestUrl: string;
  bitlabUrl: string;
  landingUrl: string;
  githubOrgUrl: string;
  verifyUrl: string;
}

const FALLBACK: LandingConfigPublic = {
  bitquestUrl: "https://www.bitquest.gandalnexus.xyz",
  bitlabUrl: "https://www.bitlab.gandalnexus.xyz",
  landingUrl: "https://www.gandalnexus.xyz",
  githubOrgUrl: "https://github.com/GandalNexus",
  verifyUrl: "https://www.bitquest.gandalnexus.xyz/verify",
};

interface CachedEntry {
  cfg: LandingConfigPublic;
  at: number;
}

/**
 * Hook client qui résout TOUTES les URL structurelles de LandingConfig
 * en un seul fetch. Même machinerie que `useLandingUrl` d'origine :
 * sessionStorage 10 min + fallback stable pour éviter les mismatch
 * d'hydratation.
 *
 * Expose un objet complet pour que les callers choisissent le champ
 * qui les intéresse (bitlabUrl pour un CTA vers BitLab, landingUrl
 * pour le bouton Nexus, verifyUrl pour vérifier un certificat, …).
 *
 * Les wrappers mono-champ (`useLandingUrl`, `useBitlabUrl`) sont des
 * selectors memo-friendly au-dessus de ce hook — ils déclenchent le
 * re-render seulement sur changement du champ ciblé.
 */
export function useLandingConfig(): LandingConfigPublic {
  const [cfg, setCfg] = useState<LandingConfigPublic>(FALLBACK);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as CachedEntry;
        if (
          cached &&
          cached.cfg &&
          typeof cached.at === "number" &&
          Date.now() - cached.at < TTL_MS
        ) {
          setCfg(cached.cfg);
          return;
        }
      }
    } catch {
      // storage inaccessible → fetch quand même
    }

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 4000);
    fetch("/api/public/landing-config", {
      method: "GET",
      signal: ac.signal,
      credentials: "omit",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Partial<LandingConfigPublic> | null) => {
        if (!data) return;
        const next: LandingConfigPublic = {
          bitquestUrl: pickHttpUrl(data.bitquestUrl, FALLBACK.bitquestUrl),
          bitlabUrl: pickHttpUrl(data.bitlabUrl, FALLBACK.bitlabUrl),
          landingUrl: pickHttpUrl(data.landingUrl, FALLBACK.landingUrl),
          githubOrgUrl: pickHttpUrl(data.githubOrgUrl, FALLBACK.githubOrgUrl),
          verifyUrl: pickHttpUrl(data.verifyUrl, FALLBACK.verifyUrl),
        };
        setCfg(next);
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ cfg: next, at: Date.now() } satisfies CachedEntry),
          );
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Silence : fallback reste visible
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      ac.abort();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return cfg;
}

/** Shortcut : juste `landingUrl`. */
export function useLandingUrl(): string {
  return useLandingConfig().landingUrl;
}

/** Shortcut : juste `bitlabUrl`. */
export function useBitlabUrl(): string {
  return useLandingConfig().bitlabUrl;
}

function pickHttpUrl(candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string") return fallback;
  try {
    const u = new URL(candidate);
    return u.protocol === "https:" || u.protocol === "http:"
      ? candidate
      : fallback;
  } catch {
    return fallback;
  }
}
