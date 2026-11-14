import { expect, test } from "@playwright/test";

/**
 * Smoke test LOT 15 — les 5 pages admin/CRUD exposent désormais une
 * barre de recherche (champ `name="q"` géré par CrudSearchBar).
 *
 * On ne vérifie pas le résultat Postgres (ILIKE, pagination, etc.) :
 * ce test a pour seul objet d'attester que la barre est rendue et que
 * `?q=foo` arrive sans erreur côté SSR (pas de crash, status < 400).
 *
 * Cas particulier : /admin/users utilise déjà un composant distinct
 * (`UsersSearchForm`) mais expose la même convention `q=`.
 */

const ADMIN_EMAIL = "admin@bitquest.local";
const ADMIN_PWD = "Admin2026!";

async function loginAsAdmin(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post("/api/auth", {
    data: { action: "login", email: ADMIN_EMAIL, password: ADMIN_PWD },
  });
  expect(res.status()).toBe(200);
}

const PAGES = [
  "/admin/courses",
  "/admin/chapters",
  "/admin/lessons",
  "/admin/challenges",
  "/admin/badges",
];

test.describe("admin search bars", () => {
  test.beforeEach(async ({ request }) => {
    await loginAsAdmin(request);
  });

  for (const path of PAGES) {
    test(`${path} rend un champ de recherche et accepte ?q=`, async ({ page }) => {
      const res = await page.goto(`${path}?q=zzz-aucun-match-zzz`);
      expect(res?.status() ?? 200).toBeLessThan(400);
      // Le champ de recherche est marqué par aria-label qui commence par "Rechercher".
      const input = page.locator('input[aria-label^="Rechercher"]').first();
      await expect(input).toBeVisible();
    });
  }
});
