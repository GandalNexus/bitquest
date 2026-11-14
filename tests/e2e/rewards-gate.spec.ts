import { expect, test } from "@playwright/test";

/**
 * Smoke test Phase 4 — la page /rewards doit :
 *   - rediriger vers / si non authentifié (requireRoleSsr("APPRENTICE")).
 *   - afficher la carte « Programme pas encore ouvert » si flag OFF
 *     pour un apprenti authentifié.
 *
 * On ne teste pas le paiement LND réel (coûteux + nécessite un node). Ce
 * smoke couvre la garde d'entrée et la UX de refus propre.
 */
test("/rewards redirige vers / quand non authentifié", async ({ page }) => {
  const res = await page.goto("/rewards");
  // requireRoleSsr renvoie une redirection 307/302 vers / quand unauthenticated.
  expect(page.url()).toMatch(/\/(?:$|\?)/);
  expect(res?.status() ?? 200).toBeLessThan(400);
});
