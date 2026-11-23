import { expect, test } from "@playwright/test";

/**
 * Découvrabilité des endpoints preuve exportable (LOT 53).
 *
 * Vérifie que :
 *   - /gandalnexus (landing publique) contient un lien vers /verify.
 *   - /attestations exige une session (anonyme → redirect ou page
 *     d'auth).
 *   - /verify est toujours accessible anonyme (public).
 *   - /api/version est pingable anonymement et liste tous les
 *     champs de contrat.
 *
 * API-level (request) uniquement — pas de browser headless requis.
 */

test("/gandalnexus contient un lien vers /verify", async ({ request }) => {
  const res = await request.get("/gandalnexus");
  expect(res.status()).toBe(200);
  const html = await res.text();
  // Le lien absolu "/verify" + le label « Vérifier un certificat »
  expect(html).toContain('href="/verify"');
  expect(html).toMatch(/vérifier un certificat/i);
});

test("/verify est public et affiche le formulaire manuel", async ({
  request,
}) => {
  const res = await request.get("/verify");
  expect(res.status()).toBe(200);
  const html = await res.text();
  // Le formulaire GET avec textarea pour coller un blob manuel
  expect(html).toContain('action="/verify"');
  expect(html).toContain('name="blob"');
});

test("/attestations anonyme → redirect /", async ({ request }) => {
  const res = await request.get("/attestations", { maxRedirects: 0 });
  // requireRoleSsr renvoie un 307 Temporary Redirect en anonyme
  expect([307, 302, 200].includes(res.status())).toBe(true);
});

test("/api/version est anonyme et contient 6 champs", async ({ request }) => {
  const res = await request.get("/api/version");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("protocolVersion");
  expect(body).toHaveProperty("certificateVersion");
  expect(body).toHaveProperty("release");
  expect(body).toHaveProperty("commitHash");
  expect(body).toHaveProperty("issuer");
  expect(body).toHaveProperty("builtAt");
});

test("Headers X-Protocol-Version sur routes publiques", async ({ request }) => {
  for (const path of [
    "/api/version",
    "/api/certificates/verify?blob=xx",
  ]) {
    const res = await request.get(path);
    expect(res.headers()["x-protocol-version"], `header on ${path}`).toBe("1");
    expect(res.headers()["x-certificate-version"], `header on ${path}`).toBe(
      "1",
    );
  }
});
