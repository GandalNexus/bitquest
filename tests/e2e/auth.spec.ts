import { expect, test } from "@playwright/test";

/**
 * Parcours d'authentification côté API : guest + login + mauvais login.
 * On vérifie la pose du cookie bq_session et la validité de /api/me.
 */

test("guest login pose les cookies et /api/me répond avec le user", async ({ request }) => {
  const login = await request.post("/api/auth", {
    data: { action: "guest" },
  });
  expect(login.status()).toBe(200);
  const body = await login.json();
  expect(body.user).toBeTruthy();
  expect(body.user.isGuest).toBe(true);
  expect(body.user.role).toBe("APPRENTICE");

  // Vérifie que les cookies ont été posés par le serveur.
  const cookies = await request.storageState();
  const names = cookies.cookies.map((c) => c.name);
  expect(names).toContain("bq_session");
  expect(names).toContain("bq_csrf");

  // /api/me doit maintenant répondre avec le même user.
  const me = await request.get("/api/me");
  expect(me.status()).toBe(200);
  const meBody = await me.json();
  expect(meBody.user.id).toBe(body.user.id);
});

test("login avec mauvais mot de passe → 401", async ({ request }) => {
  const res = await request.post("/api/auth", {
    data: {
      action: "login",
      email: "editor@bitquest.local",
      password: "wrong-password-definitely-not-right",
    },
  });
  expect(res.status()).toBe(401);
});

test("login editor-test (compte seedé) → 200 avec rôle EDITOR", async ({ request }) => {
  const res = await request.post("/api/auth", {
    data: {
      action: "login",
      email: "editor@bitquest.local",
      password: "Editor2026!",
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.user.pseudo).toBe("editor-test");
  expect(body.user.role).toBe("EDITOR");
});
