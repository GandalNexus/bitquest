import { expect, test } from "@playwright/test";

/**
 * Guard /admin : seuls les ADMIN peuvent voir le contenu.
 *
 * Note : le dev container n'a pas les libs X11/glib nécessaires pour lancer
 * Chromium, donc on vérifie le HTML rendu par le Server Component via
 * `request.get()` et on cherche le texte attendu. Les mêmes assertions
 * passent via page.goto() dans un environnement avec browser complet.
 */

async function htmlContains(request: import("@playwright/test").APIRequestContext, path: string, text: string) {
  const res = await request.get(path);
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain(text);
}

test("/admin sans session → page Session requise", async ({ request }) => {
  await htmlContains(request, "/admin", "Session requise");
});

test("/admin avec compte APPRENTICE → Accès refusé", async ({ request }) => {
  const login = await request.post("/api/auth", {
    data: {
      action: "login",
      email: "learner@bitquest.local",
      password: "Learner2026!",
    },
  });
  expect(login.status()).toBe(200);
  await htmlContains(request, "/admin", "Accès refusé");
});

test("/api/admin/courses sans auth → 401", async ({ request }) => {
  const res = await request.post("/api/admin/courses", {
    data: {
      slug: "qa-should-fail",
      title: "QA",
      subtitle: "QA",
      description: "ne devrait jamais être créé",
    },
  });
  expect(res.status()).toBe(401);
});

test("/api/admin/courses avec un apprenti → 403", async ({ request }) => {
  await request.post("/api/auth", {
    data: {
      action: "login",
      email: "learner@bitquest.local",
      password: "Learner2026!",
    },
  });
  const res = await request.post("/api/admin/courses", {
    data: {
      slug: "qa-learner-fail",
      title: "QA",
      subtitle: "QA",
      description: "ne devrait jamais être créé par un apprenti",
    },
  });
  expect(res.status()).toBe(403);
});
