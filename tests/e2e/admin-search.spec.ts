import { expect, test, type BrowserContext } from "@playwright/test";

/**
 * Smoke test LOT 15 — les 5 pages admin/CRUD exposent désormais une
 * barre de recherche (champ `name="q"` géré par CrudSearchBar).
 *
 * LOT 75 fix : login admin via APIRequestContext, puis transfert
 * des cookies vers le BrowserContext du `page` pour que page.goto
 * voie bien la session admin (sinon redirect vers /).
 */

const ADMIN_EMAIL = "admin@bitquest.local";
const ADMIN_PWD = "Admin2026!";

async function loginAsAdminIntoBrowser(
  context: BrowserContext,
  request: import("@playwright/test").APIRequestContext,
) {
  const res = await request.post("/api/auth", {
    data: { action: "login", email: ADMIN_EMAIL, password: ADMIN_PWD },
  });
  expect(res.status()).toBe(200);
  const state = await request.storageState();
  // Reporte les cookies dans le BrowserContext pour que page.goto
  // soit authentifié.
  await context.addCookies(
    state.cookies.map((c) => ({
      ...c,
      // L'URL de base est http://localhost:3000, on s'aligne.
      domain: c.domain || "localhost",
    })),
  );
}

const PAGES = [
  "/admin/courses",
  "/admin/chapters",
  "/admin/lessons",
  "/admin/challenges",
  "/admin/badges",
];

test.describe("admin search bars", () => {
  test.beforeEach(async ({ context, request }) => {
    await loginAsAdminIntoBrowser(context, request);
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
