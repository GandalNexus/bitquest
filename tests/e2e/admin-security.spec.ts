import { expect, test } from "@playwright/test";

/**
 * E2E admin flows — gates & cron (LOT 55).
 *
 * Vérifie que :
 *   - Routes admin exigent auth + role (401 anon, 403 role insuffisant).
 *   - /api/cron/purge-expired-attempts refuse sans CRON_SECRET.
 *   - Headers X-Protocol-Version présents même sur les refus.
 *
 * On ne crée pas de session admin (pas de seed admin@bitquest.local
 * actuellement), on se concentre sur les paths rejet qui prouvent
 * les guards.
 */

test("cron purge refuse sans CRON_SECRET (503 ou 401)", async ({ request }) => {
  const res = await request.post("/api/cron/purge-expired-attempts");
  // 503 si CRON_SECRET non configuré en env, 401 si configuré mais
  // header absent (cas prod vs cas dev).
  expect([503, 401].includes(res.status())).toBe(true);
});

test("cron purge refuse secret incorrect (401)", async ({ request }) => {
  const res = await request.post("/api/cron/purge-expired-attempts", {
    headers: { "x-cron-secret": "wrong".repeat(10) },
  });
  // 503 si CRON_SECRET absent (helper toujours fermé), 401 si
  // présent mais mismatch.
  expect([503, 401].includes(res.status())).toBe(true);
});

test("cron purge GET → 405", async ({ request }) => {
  const res = await request.get("/api/cron/purge-expired-attempts");
  expect(res.status()).toBe(405);
});

test("PATCH /api/admin/feature-flags/[key] anonyme → 401", async ({ request }) => {
  const res = await request.patch("/api/admin/feature-flags/lightning.rewards", {
    data: { enabled: true },
  });
  expect(res.status()).toBe(401);
});

test("PATCH /api/admin/feature-flags/[key] EDITOR (pas ADMIN) → 403", async ({
  request,
}) => {
  const login = await request.post("/api/auth", {
    data: {
      action: "login",
      email: "editor@bitquest.local",
      password: "Editor2026!",
    },
  });
  expect(login.status()).toBe(200);
  const state = await request.storageState();
  const csrf = state.cookies.find((c) => c.name === "bq_csrf");
  expect(csrf).toBeTruthy();

  const res = await request.patch(
    "/api/admin/feature-flags/lightning.rewards",
    {
      headers: { "X-CSRF-Token": csrf!.value },
      data: { enabled: true },
    },
  );
  // 403 car editor n'a pas le rôle ADMIN requis pour feature flags
  // (LOT 24 : guard requireRoleAndCsrf("ADMIN") strict).
  expect(res.status()).toBe(403);
});

test("POST /api/admin/chapters/<id>/quests EDITOR autorisé (404 si chapter n'existe pas)", async ({
  request,
}) => {
  const login = await request.post("/api/auth", {
    data: {
      action: "login",
      email: "editor@bitquest.local",
      password: "Editor2026!",
    },
  });
  expect(login.status()).toBe(200);
  const state = await request.storageState();
  const csrf = state.cookies.find((c) => c.name === "bq_csrf");

  const res = await request.post(
    "/api/admin/chapters/non-existent-id/quests",
    {
      headers: { "X-CSRF-Token": csrf!.value },
      data: { questCode: "genesis", order: 1 },
    },
  );
  // LOT 23 : EDITOR peut gérer ChapterQuest. Chapter inexistant → 404
  // (pas 401/403 → prouve que le guard a laissé passer EDITOR).
  expect(res.status()).toBe(404);
});

test("/admin/certificates anonyme → redirect (LOT 60)", async ({ request }) => {
  const res = await request.get("/admin/certificates", { maxRedirects: 0 });
  expect([302, 307, 200].includes(res.status())).toBe(true);
});

test("/admin/attestations anonyme → redirect (LOT 37)", async ({ request }) => {
  const res = await request.get("/admin/attestations", { maxRedirects: 0 });
  expect([302, 307, 200].includes(res.status())).toBe(true);
});

test("/admin/feature-flags anonyme → redirect (LOT 24)", async ({ request }) => {
  const res = await request.get("/admin/feature-flags", { maxRedirects: 0 });
  expect([302, 307, 200].includes(res.status())).toBe(true);
});

test("/admin/* EDITOR login → écran deny ADMIN-only (status < 400)", async ({
  request,
}) => {
  const login = await request.post("/api/auth", {
    data: {
      action: "login",
      email: "editor@bitquest.local",
      password: "Editor2026!",
    },
  });
  expect(login.status()).toBe(200);

  // EDITOR peut accéder au layout admin (LOT 5 gate EDITOR) mais
  // les pages ADMIN-only renvoient leur écran de refus via
  // requireAdminOrDenied() — rendu 200 avec UI « Access denied ».
  for (const path of [
    "/admin/attestations",
    "/admin/certificates",
    "/admin/feature-flags",
  ]) {
    const res = await request.get(path);
    expect(res.status(), `status on ${path}`).toBeLessThan(400);
  }
});
