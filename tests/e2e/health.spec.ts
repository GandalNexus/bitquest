import { expect, test } from "@playwright/test";

/**
 * Health check — endpoint public utilisé par les load balancers.
 * Zéro auth, zéro CSRF, toujours accessible.
 */
test("GET /api/health renvoie 200 avec DB et Redis OK", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toMatch(/ok|degraded/);
  expect(body.db.status).toBe("ok");
  expect(body.env).toBeTruthy();
  expect(body.version).toBeTruthy();
});
