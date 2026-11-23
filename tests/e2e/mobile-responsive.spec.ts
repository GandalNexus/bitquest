import { expect, test, type Page } from "@playwright/test";

/**
 * Mobile responsive smoke tests (LOT 74).
 *
 * Vise 3 viewports : iPhone SE (375×667), iPhone 12 Pro (390×844),
 * iPad (768×1024). Vérifie que les pages publiques et /dashboard,
 * /academy rendent sans overflow horizontal cassé.
 *
 * On ne teste pas visuellement (pas de snapshots) — on vérifie que
 * `document.documentElement.scrollWidth <= innerWidth + marge`
 * (pas de scrollbar horizontale permanente qui trahirait un bug
 * de layout).
 */

const DEVICES = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 12 Pro", width: 390, height: 844 },
  { name: "iPad", width: 768, height: 1024 },
];

const PAGES = [
  { path: "/", label: "root (SPA)" },
  { path: "/academy", label: "academy catalog" },
  { path: "/academy/fondamentaux-bitcoin", label: "academy course" },
  { path: "/verify", label: "verify public" },
  { path: "/gandalnexus", label: "landing" },
];

async function hasHorizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
}

for (const device of DEVICES) {
  test.describe(`mobile ${device.name} (${device.width}×${device.height})`, () => {
    test.use({ viewport: { width: device.width, height: device.height } });

    for (const { path, label } of PAGES) {
      test(`${path} (${label}) pas d'overflow horizontal > 8px`, async ({ page }) => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        const overflow = await hasHorizontalOverflow(page);
        // Marge 8px pour tolérer les scrollbars custom et les
        // rounding errors de CSS. Au-delà = vrai overflow bug.
        expect(
          overflow,
          `overflow sur ${path} @ ${device.width}px = ${overflow}px`,
        ).toBeLessThanOrEqual(8);
      });
    }
  });
}
