import { expect, test } from "@playwright/test";

/**
 * Flow quête — scénario d'intégration niveau API :
 *
 *   register → start quest → read section → mission_start bloquée par quiz.
 *
 * On ne va pas jusqu'au mission_submit → COMPLETED parce que les réponses
 * de quiz sont stockées server-side (JSON encrypté) et le test ne doit pas
 * dépendre de la connaissance du seed. Ce qui est testé ici :
 *   1. Pipeline register → cookie session + CSRF.
 *   2. Validation Zod password ≥ 10 chars (LOT 14).
 *   3. Action `start` sur une quête SIMULATED (genesis = block_explorer).
 *   4. Progression `read_section` → sectionsRead++.
 *   5. State machine : `mission_start` refusé 403 si quiz pas encore passé.
 *
 * Idempotence : chaque test utilise un email unique via `Date.now()`.
 */

test("register avec password 9 chars → 400 (Zod)", async ({ request }) => {
  const now = Date.now();
  const res = await request.post("/api/auth", {
    data: {
      action: "register",
      email: `e2e-short-${now}@test.local`,
      pseudo: `e2e-short-${now % 10_000_000}`,
      password: "123456789", // 9 chars < 10 requis
    },
  });
  expect(res.status()).toBe(400);
});

test("register → start genesis → read section → mission_start bloquée", async ({
  request,
}) => {
  const now = Date.now();
  const email = `e2e-flow-${now}@test.local`;
  const pseudo = `e2e-${now % 10_000_000}`;

  // 1. Register (password ≥ 10 → OK)
  const register = await request.post("/api/auth", {
    data: {
      action: "register",
      email,
      pseudo,
      password: "AzertyLongPwd!",
    },
  });
  expect(register.status()).toBe(200);
  const regBody = await register.json();
  expect(regBody.user.pseudo).toBe(pseudo);

  // 2. Récupère le CSRF cookie readable
  const state = await request.storageState();
  const csrf = state.cookies.find((c) => c.name === "bq_csrf");
  expect(csrf).toBeTruthy();
  const headers = { "X-CSRF-Token": csrf!.value };

  // 3. Start quest `genesis` (SIMULATED : block_explorer)
  const start = await request.post("/api/quests/genesis/progress", {
    headers,
    data: { action: "start" },
  });
  expect(start.status()).toBe(200);
  const startBody = await start.json();
  expect(startBody.progress.status).toBeTruthy();

  // 4. Read section 0 → sectionsRead doit incrémenter à 1
  const section0 = await request.post("/api/quests/genesis/progress", {
    headers,
    data: { action: "read_section", sectionIndex: 0 },
  });
  expect(section0.status()).toBe(200);
  const section0Body = await section0.json();
  expect(section0Body.progress.sectionsRead).toBeGreaterThanOrEqual(1);

  // 5. Tenter mission_start sans avoir validé le quiz → 403
  //    (QUIZ_PASS_THRESHOLD = 70% — quiz non tenté donc blocké)
  const missionStart = await request.post("/api/quests/genesis/progress", {
    headers,
    data: { action: "mission_start" },
  });
  expect(missionStart.status()).toBe(403);
  const err = await missionStart.json();
  expect(err.error).toMatch(/quiz/i);
});
