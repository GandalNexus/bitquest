import { defineConfig, devices } from "@playwright/test";

/**
 * Config Playwright — Phase 5.2.
 *
 * Les tests pointent sur le dev server (localhost:3000) qui doit être up.
 * Dans le workflow habituel : `docker compose -f docker-compose.dev.yml up -d`
 * puis `npm run e2e` depuis le conteneur.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // les tests partagent la DB — on les enchaîne pour éviter les conflits
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
