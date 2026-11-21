import { describe, it, expect, afterEach, vi } from "vitest";
import { allowedOrigins, isOriginAllowed, corsHeaders, preflight } from "./cors";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cors.allowedOrigins", () => {
  it("dev sans config → null (permissif)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(allowedOrigins()).toBeNull();
  });

  it("dev avec * → null (permissif)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "*");
    expect(allowedOrigins()).toBeNull();
  });

  it("prod sans config → [] (refus total)", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(allowedOrigins()).toEqual([]);
  });

  it("prod avec * → [] (refus total, pas de wildcard)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "*");
    expect(allowedOrigins()).toEqual([]);
  });

  it("prod avec liste explicite → liste parsée", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "https://a.io,https://b.io");
    expect(allowedOrigins()).toEqual(["https://a.io", "https://b.io"]);
  });

  it("filtre les wildcards mélangés dans la liste", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "https://ok.io,*");
    expect(allowedOrigins()).toEqual(["https://ok.io"]);
  });

  it("trim les entrées", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BITLAB_ALLOWED_ORIGINS", " https://a.io  , https://b.io ");
    expect(allowedOrigins()).toEqual(["https://a.io", "https://b.io"]);
  });
});

describe("cors.isOriginAllowed", () => {
  it("dev permissif : accepte toute origin non-nulle", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isOriginAllowed("http://localhost:3001")).toBe(true);
    expect(isOriginAllowed("https://attacker.io")).toBe(true);
  });

  it("dev permissif : refuse null", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isOriginAllowed(null)).toBe(false);
  });

  it("prod sans config : refuse tout", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isOriginAllowed("https://ok.io")).toBe(false);
  });

  it("prod avec allowlist : accepte exactement, refuse les autres", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "https://bitlab.io");
    expect(isOriginAllowed("https://bitlab.io")).toBe(true);
    expect(isOriginAllowed("https://attacker.io")).toBe(false);
    expect(isOriginAllowed("https://bitlab.io/")).toBe(false); // trailing slash rejeté
  });

  it("prod refuse null", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "https://bitlab.io");
    expect(isOriginAllowed(null)).toBe(false);
  });
});

describe("cors.corsHeaders", () => {
  it("permissif dev : reflète l'origin (jamais *)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const h = corsHeaders("http://localhost:3001");
    expect(h["Access-Control-Allow-Origin"]).toBe("http://localhost:3001");
    expect(h["Access-Control-Allow-Origin"]).not.toBe("*");
  });

  it("prod origine refusée : pas de header Allow-Origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "https://ok.io");
    const h = corsHeaders("https://attacker.io");
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("prod origine autorisée : reflète", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "https://ok.io");
    const h = corsHeaders("https://ok.io");
    expect(h["Access-Control-Allow-Origin"]).toBe("https://ok.io");
  });

  it("toujours Vary: Origin pour cacher", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(corsHeaders(null).Vary).toBe("Origin");
  });

  it("methods customisables", () => {
    vi.stubEnv("NODE_ENV", "development");
    const h = corsHeaders("http://a", ["GET", "OPTIONS"]);
    expect(h["Access-Control-Allow-Methods"]).toBe("GET, OPTIONS");
  });
});

describe("cors.preflight", () => {
  // Note : undici Request strips "Origin" (forbidden fetch header). On passe
  // un stub minimal qui expose uniquement .headers.get() — c'est tout ce
  // que preflight utilise côté runtime.
  function makeReq(origin: string | null): Request {
    return {
      headers: { get: (name: string) => (name.toLowerCase() === "origin" ? origin : null) },
    } as unknown as Request;
  }

  it("retourne 204 avec headers CORS", () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = preflight(makeReq("http://localhost:3001"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
  });

  it("prod sans allowlist : 204 sans Allow-Origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = preflight(makeReq("https://anything.io"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
