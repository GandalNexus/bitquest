import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  buildClearCsrfCookie,
  buildCsrfCookie,
  computeCsrfToken,
  isCookieAuthenticated,
  requireCsrf,
  verifyCsrfToken,
} from "./csrf";

/* ------------------------------------------------------------------ */
/* Isolation du secret                                                 */
/* ------------------------------------------------------------------ */

const ORIGINAL_SECRET = process.env.CSRF_SECRET;

beforeEach(() => {
  process.env.CSRF_SECRET = "test-secret-fixture";
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CSRF_SECRET;
  else process.env.CSRF_SECRET = ORIGINAL_SECRET;
});

/* ------------------------------------------------------------------ */
/* computeCsrfToken                                                    */
/* ------------------------------------------------------------------ */

describe("computeCsrfToken", () => {
  it("retourne un hex SHA-256 (64 caractères)", () => {
    const token = computeCsrfToken("session-abc");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("est déterministe : même input → même output", () => {
    expect(computeCsrfToken("s1")).toBe(computeCsrfToken("s1"));
  });

  it("change si le session token change", () => {
    expect(computeCsrfToken("s1")).not.toBe(computeCsrfToken("s2"));
  });

  it("change si le secret change", () => {
    const t1 = computeCsrfToken("s");
    process.env.CSRF_SECRET = "another-secret";
    const t2 = computeCsrfToken("s");
    expect(t1).not.toBe(t2);
  });
});

/* ------------------------------------------------------------------ */
/* verifyCsrfToken                                                     */
/* ------------------------------------------------------------------ */

describe("verifyCsrfToken", () => {
  it("accepte un token correct", () => {
    const session = "s-token";
    expect(verifyCsrfToken(session, computeCsrfToken(session))).toBe(true);
  });

  it("rejette un token nul / vide / undefined", () => {
    expect(verifyCsrfToken("s", null)).toBe(false);
    expect(verifyCsrfToken("s", undefined)).toBe(false);
    expect(verifyCsrfToken("s", "")).toBe(false);
  });

  it("rejette un token de la mauvaise longueur", () => {
    expect(verifyCsrfToken("s", "short")).toBe(false);
  });

  it("rejette un token fabriqué (même longueur)", () => {
    const fake = "a".repeat(64);
    expect(verifyCsrfToken("s", fake)).toBe(false);
  });

  it("rejette un token calculé avec un autre secret", () => {
    const correct = computeCsrfToken("s");
    process.env.CSRF_SECRET = "different";
    expect(verifyCsrfToken("s", correct)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* buildCsrfCookie / buildClearCsrfCookie                              */
/* ------------------------------------------------------------------ */

describe("buildCsrfCookie", () => {
  it("contient le nom, la valeur URL-encodée, Path, SameSite — PAS HttpOnly", () => {
    const c = buildCsrfCookie("abc123", { secure: false });
    expect(c).toContain(`${CSRF_COOKIE}=abc123`);
    expect(c).toContain("Path=/");
    expect(c).toContain("SameSite=Lax");
    expect(c).not.toContain("HttpOnly");
  });

  it("ajoute Max-Age si fourni", () => {
    const c = buildCsrfCookie("t", { maxAgeSeconds: 3600, secure: false });
    expect(c).toContain("Max-Age=3600");
  });
});

describe("buildClearCsrfCookie", () => {
  it("fixe la valeur à vide + Max-Age=0", () => {
    const c = buildClearCsrfCookie({ secure: false });
    expect(c).toContain(`${CSRF_COOKIE}=`);
    expect(c).toContain("Max-Age=0");
  });
});

/* ------------------------------------------------------------------ */
/* requireCsrf (route-level helper)                                    */
/* ------------------------------------------------------------------ */

function makeRequest(opts: { csrfHeader?: string }): Request {
  const headers: HeadersInit = {};
  if (opts.csrfHeader !== undefined) headers[CSRF_HEADER] = opts.csrfHeader;
  return new Request("http://localhost/api/test", { method: "POST", headers });
}

describe("requireCsrf", () => {
  it("accepte quand le header contient le bon token", () => {
    const session = "s-token";
    const req = makeRequest({ csrfHeader: computeCsrfToken(session) });
    const r = requireCsrf(req, session);
    expect(r.ok).toBe(true);
  });

  it("refuse quand le header est absent — 403", async () => {
    const req = makeRequest({});
    const r = requireCsrf(req, "s-token");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(403);
      const body = await r.response.json();
      expect(body.error).toMatch(/csrf/i);
    }
  });

  it("refuse un header falsifié", () => {
    const req = makeRequest({ csrfHeader: "a".repeat(64) });
    const r = requireCsrf(req, "s-token");
    expect(r.ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* isCookieAuthenticated                                               */
/* ------------------------------------------------------------------ */

describe("isCookieAuthenticated", () => {
  /**
   * NB : happy-dom (environnement vitest) retire le header "cookie" des
   * Request constructeur — on utilise donc un stub minimal qui expose
   * `.headers.get("cookie")` comme ferait un Request réel côté serveur.
   */
  function stubRequest(cookieHeader: string | null): Request {
    return {
      headers: { get: (name: string) => (name.toLowerCase() === "cookie" ? cookieHeader : null) },
    } as unknown as Request;
  }

  it("vrai si bq_session est présent dans le cookie", () => {
    expect(isCookieAuthenticated(stubRequest("bq_session=abc; other=1"))).toBe(true);
  });

  it("faux si aucun cookie bq_session", () => {
    expect(isCookieAuthenticated(stubRequest("other=1"))).toBe(false);
  });

  it("faux si aucun header cookie du tout", () => {
    expect(isCookieAuthenticated(stubRequest(null))).toBe(false);
  });
});
