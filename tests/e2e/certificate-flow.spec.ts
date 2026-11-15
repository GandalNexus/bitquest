import { expect, test } from "@playwright/test";

/**
 * Flow end-to-end Attestation → Certificate → /verify (LOT 50).
 *
 * Scénario :
 *   1. Guest login → cookies bq_session + bq_csrf posés.
 *   2. POST /api/me/attestations/<id>/certificate échoue 404 car
 *      aucune attestation (vérifie le guard anti-IDOR / existence).
 *   3. /api/certificates/verify?blob=malformed → 400 avec
 *      X-Protocol-Version header.
 *   4. /api/version → 200 avec les champs attendus.
 *   5. /verify (page HTML anonyme) → 200.
 *   6. /verify?blob=malformed (page HTML) → 200 état « ko ».
 *
 * Ce flow ne crée pas d'Attestation (nécessiterait une quête
 * complétée, trop coûteux ici). Il vérifie le pipeline exposition
 * publique + headers protocolaires + guards d'accès.
 */

test("/api/version expose les champs auto-découverte", async ({ request }) => {
  const res = await request.get("/api/version");
  expect(res.status()).toBe(200);
  expect(res.headers()["x-protocol-version"]).toBe("1");
  expect(res.headers()["x-certificate-version"]).toBe("1");
  const body = await res.json();
  expect(body.protocolVersion).toBe(1);
  expect(body.certificateVersion).toBe(1);
  expect(typeof body.release).toBe("string");
  expect(body).toHaveProperty("issuer");
});

test("/api/certificates/verify rejette un blob malformé avec headers", async ({
  request,
}) => {
  const res = await request.get("/api/certificates/verify?blob=malformed-x");
  expect(res.status()).toBe(400);
  expect(res.headers()["x-protocol-version"]).toBe("1");
  const body = await res.json();
  expect(body.ok).toBe(false);
  expect(body.error).toBeTruthy();
});

test("/api/certificates/verify sans blob → 400", async ({ request }) => {
  const res = await request.get("/api/certificates/verify");
  expect(res.status()).toBe(400);
});

test("/verify (anonyme) rend la page d'accueil (HTML)", async ({ request }) => {
  const res = await request.get("/verify");
  expect(res.status()).toBeLessThan(400);
  const html = await res.text();
  // Le titre `h1` contient « Vérifier un certificat »
  expect(html).toMatch(/vérifier un certificat/i);
});

test("/verify?blob=invalid affiche l'état KO (HTML)", async ({ request }) => {
  const res = await request.get("/verify?blob=not-a-valid-blob");
  expect(res.status()).toBeLessThan(400);
  const html = await res.text();
  // La carte d'erreur contient « Certificat invalide »
  expect(html).toMatch(/certificat invalide/i);
});

test("Attestation certificate requires auth + ownership", async ({ request }) => {
  // Anonyme → 401
  const anon = await request.post("/api/me/attestations/fake-id/certificate");
  expect(anon.status()).toBe(401);
  expect(anon.headers()["x-protocol-version"]).toBe("1");

  // Guest login
  const login = await request.post("/api/auth", { data: { action: "guest" } });
  expect(login.status()).toBe(200);

  const state = await request.storageState();
  const csrf = state.cookies.find((c) => c.name === "bq_csrf");
  expect(csrf).toBeTruthy();

  // Attestation fantôme → 404 (anti-IDOR)
  const fake = await request.post("/api/me/attestations/non-existent-id/certificate", {
    headers: { "X-CSRF-Token": csrf!.value },
  });
  expect(fake.status()).toBe(404);
});
