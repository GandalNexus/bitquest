import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Audit a11y des pages publiques — Phase 5.3.
 *
 * On scanne avec axe-core (règles WCAG 2.1 AA par défaut) et on échoue
 * s'il reste des violations de sévérité `serious` ou `critical`. Les
 * violations `minor` et `moderate` sont rapportées mais non bloquantes.
 *
 * Note : ces tests nécessitent un browser complet. Dans le dev container
 * minimaliste, Chromium ne démarre pas (libglib absent). Ils passent en
 * CI avec `playwright install --with-deps chromium`.
 */

const PAGES_TO_AUDIT: { path: string; name: string }[] = [
  { path: "/", name: "root (SPA / AuthScreen)" },
  { path: "/academy", name: "Academy catalogue" },
  { path: "/dashboard", name: "Dashboard" },
];

for (const { path, name } of PAGES_TO_AUDIT) {
  test(`${name} — pas de violation WCAG serious/critical`, async ({ page }) => {
    await page.goto(path);
    // Laisse le temps aux hydrations client
    await page.waitForLoadState("networkidle").catch(() => {});

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    if (blocking.length > 0) {
      const summary = blocking
        .map((v) => `  [${v.impact}] ${v.id}: ${v.help}\n    nodes: ${v.nodes.length}`)
        .join("\n");
      console.error(`${blocking.length} violations bloquantes:\n${summary}`);
    }

    expect(blocking).toEqual([]);
  });
}
