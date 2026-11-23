/**
 * Helper strict pour normaliser le query param `?from=` sur `/rewards`.
 * Le code de quête vient d'une bannière de redirection (CTA depuis la
 * RewardsStep du quest-player) — il doit absolument matcher le pattern
 * slug Prisma (a-z, 0-9, _, -) et avoir une longueur raisonnable, sinon
 * on l'ignore (défense anti-XSS / injection URL arbitraire).
 */
const QUEST_CODE_RE = /^[a-z0-9_-]{1,40}$/;

export function parseQuestCodeHint(raw: string | undefined | null): string | null {
  if (typeof raw !== "string") return null;
  if (!QUEST_CODE_RE.test(raw)) return null;
  return raw;
}
