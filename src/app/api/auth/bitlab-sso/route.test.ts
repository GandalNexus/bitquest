/**
 * Tests de sécurité de la route GET /api/auth/bitlab-sso.
 *
 * Scénarios couverts :
 *   - 429 rate-limit IP (fenêtre 30/60s).
 *   - 400 returnTo absent / malformé / dangereux (javascript:, data:).
 *   - 400 returnTo hors allowlist BITLAB_ALLOWED_ORIGINS.
 *   - 302 vers "/" avec returnTo préservé si pas de session.
 *   - 302 vers <returnTo>?launch_token=XXX si session valide.
 *   - Préserve path + query existants de returnTo (juste ajoute le token).
 *
 * Mocks :
 *   - @/lib/db : user.findUnique → session fake.
 *   - @/lib/cache/redis : null → rate-limit fallback in-memory (clé IP
 *     unique par test pour éviter les leaks entre scénarios).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mock direct de `authenticate` (plus fiable qu'un mock de Prisma, qui
 * dépend du graphe d'imports complet du module `session.ts`). Les autres
 * exports (clientIp, rateLimit) utilisent les implémentations réelles.
 */
const authenticateMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bitquest/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bitquest/session")>(
    "@/lib/bitquest/session",
  );
  return { ...actual, authenticate: authenticateMock };
});

const getRedisMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock("@/lib/cache/redis", () => ({ getRedis: () => getRedisMock() }));

/* ---------- Imports — APRÈS les vi.mock ---------- */

import { GET } from "./route";

const JWT_SECRET = "dev-sso-secret-at-least-32-bytes-ok-abc";

/** IP unique par test : le fallback in-memory du rate-limit est global
 * et persiste entre tests. Un suffixe aléatoire garantit l'isolation. */
let testIp = "";
function freshIp(): string {
  testIp = `10.0.0.${Math.floor(Math.random() * 250) + 1}-${Date.now()}`;
  return testIp;
}

function makeGet(url: string, ip = testIp): Request {
  return new Request(url, {
    method: "GET",
    headers: {
      "x-forwarded-for": ip,
      cookie: "", // par défaut, pas de session
    },
  });
}

function makeGetWithSession(url: string, token: string, ip = testIp): Request {
  return new Request(url, {
    method: "GET",
    headers: {
      "x-forwarded-for": ip,
      cookie: `bq_session=${encodeURIComponent(token)}`,
    },
  });
}

beforeEach(() => {
  freshIp();
  authenticateMock.mockReset();
  authenticateMock.mockResolvedValue(null);
  process.env.BITLAB_LAUNCH_SECRET = JWT_SECRET;
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.BITLAB_ALLOWED_ORIGINS;
});

describe("GET /api/auth/bitlab-sso — validation returnTo", () => {
  it("rejette 400 si returnTo absent", async () => {
    const res = await GET(makeGet("http://localhost/api/auth/bitlab-sso"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/returnTo/i);
  });

  it("rejette 400 si returnTo malformé", async () => {
    const res = await GET(
      makeGet("http://localhost/api/auth/bitlab-sso?returnTo=not-a-url"),
    );
    expect(res.status).toBe(400);
  });

  it("rejette 400 si returnTo utilise javascript:", async () => {
    const res = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent("javascript:alert(1)")}`,
      ),
    );
    expect(res.status).toBe(400);
  });

  it("rejette 400 si returnTo utilise data:", async () => {
    const res = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent("data:text/html,<script>alert(1)</script>")}`,
      ),
    );
    expect(res.status).toBe(400);
  });

  it("rejette 400 si returnTo hors allowlist BITLAB_ALLOWED_ORIGINS", async () => {
    process.env.BITLAB_ALLOWED_ORIGINS = "https://bitlab.example.com";
    const res = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent("https://attacker.io/steal")}`,
      ),
    );
    expect(res.status).toBe(400);
  });

  it("accepte returnTo dans l'allowlist", async () => {
    process.env.BITLAB_ALLOWED_ORIGINS = "https://bitlab.example.com";
    authenticateMock.mockResolvedValue(null); // pas de session
    const res = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent("https://bitlab.example.com/")}`,
      ),
    );
    expect(res.status).toBe(302);
  });

  it("accepte toute URL http(s) si allowlist = * (dev)", async () => {
    // BITLAB_ALLOWED_ORIGINS non défini → fallback "*" permissif
    authenticateMock.mockResolvedValue(null);
    const res = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent("http://localhost:3001/foo")}`,
      ),
    );
    expect(res.status).toBe(302);
  });
});

describe("GET /api/auth/bitlab-sso — redirects", () => {
  const SESSION_TOKEN = "session-tok-xyz";
  const USER = {
    id: "user-123",
    pseudo: "satoshi",
    role: "APPRENTICE",
    email: "s@example.com",
    emailVerifiedAt: null,
    token: SESSION_TOKEN,
    deletedAt: null,
  };

  /**
   * Simule un user authentifié via le mock direct d'authenticate.
   * On ne re-vérifie pas le cookie côté mock (c'est la responsabilité du
   * vrai `authenticate`, testé ailleurs). Ici on contrôle juste la
   * valeur retournée.
   */
  function mockUserByToken(user: (typeof USER & { deletedAt: Date | null }) | null) {
    authenticateMock.mockImplementation(async () => {
      if (!user) return null;
      if (user.deletedAt !== null) return null;
      return user;
    });
  }

  it("sans session → redirige vers / avec returnTo préservé", async () => {
    mockUserByToken(null);
    const returnTo = "http://localhost:3001/foo";
    const res = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent(returnTo)}`,
      ),
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location");
    expect(loc).toBeTruthy();
    const url = new URL(loc!);
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("returnTo")).toBe(returnTo);
  });

  it("avec session → redirige vers <returnTo>?launch_token=XXX", async () => {
    mockUserByToken(USER);
    const returnTo = "http://localhost:3001/bitlab";
    const res = await GET(
      makeGetWithSession(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent(returnTo)}`,
        SESSION_TOKEN,
      ),
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location");
    expect(loc).toBeTruthy();
    const url = new URL(loc!);
    expect(url.origin + url.pathname).toBe("http://localhost:3001/bitlab");
    const token = url.searchParams.get("launch_token");
    expect(token).toBeTruthy();
    // JWT format : 3 segments base64url séparés par points.
    expect(token!.split(".")).toHaveLength(3);
  });

  it("préserve les query params existants du returnTo", async () => {
    mockUserByToken(USER);
    const returnTo = "http://localhost:3001/bitlab?foo=bar&tab=wallet";
    const res = await GET(
      makeGetWithSession(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent(returnTo)}`,
        SESSION_TOKEN,
      ),
    );
    const url = new URL(res.headers.get("location")!);
    expect(url.searchParams.get("foo")).toBe("bar");
    expect(url.searchParams.get("tab")).toBe("wallet");
    expect(url.searchParams.get("launch_token")).toBeTruthy();
  });

  it("utilisateur soft-deleted → traité comme pas de session", async () => {
    mockUserByToken({ ...USER, deletedAt: new Date() as unknown as null });
    const returnTo = "http://localhost:3001/bitlab";
    const res = await GET(
      makeGetWithSession(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent(returnTo)}`,
        SESSION_TOKEN,
      ),
    );
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("location")!);
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("launch_token")).toBeNull();
  });
});

describe("GET /api/auth/bitlab-sso — rate limit", () => {
  it("rejette 429 après 30 requêtes dans la fenêtre 60s", async () => {
    const ip = freshIp();
    authenticateMock.mockResolvedValue(null);
    const returnTo = "http://localhost:3001/";
    // 30 requêtes autorisées, la 31e doit être 429.
    for (let i = 0; i < 30; i++) {
      const res = await GET(
        makeGet(
          `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent(returnTo)}`,
          ip,
        ),
      );
      // Même sans session, on obtient 302 (pas 429 tant que sous la limite).
      expect(res.status).toBe(302);
    }
    const blocked = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent(returnTo)}`,
        ip,
      ),
    );
    expect(blocked.status).toBe(429);
  });

  it("une IP différente n'est pas bloquée par l'historique d'une autre", async () => {
    authenticateMock.mockResolvedValue(null);
    const ip1 = freshIp();
    const ip2 = freshIp();
    const returnTo = "http://localhost:3001/";
    // Saturer ip1
    for (let i = 0; i < 30; i++) {
      await GET(
        makeGet(
          `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent(returnTo)}`,
          ip1,
        ),
      );
    }
    // ip2 doit toujours passer
    const res = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-sso?returnTo=${encodeURIComponent(returnTo)}`,
        ip2,
      ),
    );
    expect(res.status).toBe(302);
  });
});
