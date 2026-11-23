import { expect, test } from "@playwright/test";

/**
 * Parcours défi du jour : GET public, complete authentifié, idempotence.
 */
test("défi du jour : GET public → challenge visible, complete → XP + sats", async ({ request }) => {
  const anon = await request.get("/api/challenges/today");
  expect(anon.status()).toBe(200);
  const anonBody = await anon.json();
  // En dev le seed pose un défi — on vérifie la forme sans enforcer la valeur.
  expect(anonBody.challenge).toBeTruthy();
  expect(typeof anonBody.challenge.title).toBe("string");

  // Login guest pour avoir une identité
  const login = await request.post("/api/auth", { data: { action: "guest" } });
  expect(login.status()).toBe(200);

  // Récupérer le CSRF token depuis le cookie (readable)
  const state = await request.storageState();
  const csrfCookie = state.cookies.find((c) => c.name === "bq_csrf");
  expect(csrfCookie).toBeTruthy();

  // Premier complete → xpGained > 0
  const first = await request.post("/api/challenges/complete", {
    headers: { "X-CSRF-Token": csrfCookie!.value },
    data: {},
  });
  expect(first.status()).toBe(200);
  const firstBody = await first.json();
  expect(firstBody.ok).toBe(true);
  expect(firstBody.alreadyCompleted).toBe(false);
  expect(firstBody.xpGained).toBeGreaterThan(0);

  // Deuxième complete → alreadyCompleted:true, xp=0 (idempotent)
  const second = await request.post("/api/challenges/complete", {
    headers: { "X-CSRF-Token": csrfCookie!.value },
    data: {},
  });
  expect(second.status()).toBe(200);
  const secondBody = await second.json();
  expect(secondBody.alreadyCompleted).toBe(true);
  expect(secondBody.xpGained).toBe(0);
});
