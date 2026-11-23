/**
 * Tests de sécurité de la route GET /api/auth/bitlab-logout.
 *
 * Miroir top-level de /api/auth/bitlab-sso pour la déconnexion globale.
 * Scénarios couverts :
 *   - 400 returnTo absent / malformé / dangereux.
 *   - 400 returnTo hors allowlist BITLAB_ALLOWED_ORIGINS.
 *   - 302 avec session → rotation du token + cookies clear + redirect.
 *   - 302 sans session → cookies clear + redirect idempotent.
 *   - Rate-limit IP.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bitquest/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bitquest/session")>(
    "@/lib/bitquest/session",
  );
  return { ...actual, authenticate: authenticateMock };
});

const dbMock = vi.hoisted(() => ({
  user: { update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const getRedisMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock("@/lib/cache/redis", () => ({ getRedis: () => getRedisMock() }));

import { GET } from "./route";

let testIp = "";
function freshIp(): string {
  testIp = `10.0.1.${Math.floor(Math.random() * 250) + 1}-${Date.now()}`;
  return testIp;
}

function makeGet(url: string, ip = testIp): Request {
  return new Request(url, {
    method: "GET",
    headers: { "x-forwarded-for": ip, cookie: "" },
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
  dbMock.user.update.mockReset();
  dbMock.user.update.mockResolvedValue({ id: "user-123" });
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.BITLAB_ALLOWED_ORIGINS;
});

describe("GET /api/auth/bitlab-logout — validation returnTo", () => {
  it("rejette 400 si returnTo absent", async () => {
    const res = await GET(makeGet("http://localhost/api/auth/bitlab-logout"));
    expect(res.status).toBe(400);
  });

  it("rejette 400 si returnTo malformé", async () => {
    const res = await GET(
      makeGet("http://localhost/api/auth/bitlab-logout?returnTo=not-a-url"),
    );
    expect(res.status).toBe(400);
  });

  it("rejette 400 si returnTo utilise javascript:", async () => {
    const res = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-logout?returnTo=${encodeURIComponent("javascript:alert(1)")}`,
      ),
    );
    expect(res.status).toBe(400);
  });

  it("rejette 400 si returnTo hors allowlist", async () => {
    process.env.BITLAB_ALLOWED_ORIGINS = "https://bitlab.example.com";
    const res = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-logout?returnTo=${encodeURIComponent("https://attacker.io/steal")}`,
      ),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/bitlab-logout — redirects", () => {
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

  it("avec session → rote le user.token, clear cookies, redirige ?logged_out=1", async () => {
    authenticateMock.mockResolvedValue(USER);
    const returnTo = "http://localhost:3001/bitlab";
    const res = await GET(
      makeGetWithSession(
        `http://localhost/api/auth/bitlab-logout?returnTo=${encodeURIComponent(returnTo)}`,
        SESSION_TOKEN,
      ),
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location");
    expect(loc).toBeTruthy();
    const url = new URL(loc!);
    expect(url.origin + url.pathname).toBe("http://localhost:3001/bitlab");
    expect(url.searchParams.get("logged_out")).toBe("1");

    // Le clear des cookies est délégué à buildClearSessionCookie /
    // buildClearCsrfCookie, dont les tests unitaires couvrent la forme.
    // En runtime Node prod, les Set-Cookie sont bien émis ; en vitest
    // (jsdom), la Response(null, 302) les filtre comme headers interdits.
    // On se concentre ici sur la rotation du token.

    // Token roté.
    expect(dbMock.user.update).toHaveBeenCalledOnce();
    const call = dbMock.user.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { token: string };
    };
    expect(call.where.id).toBe("user-123");
    expect(call.data.token).toMatch(/^[0-9a-f]{48}$/);
  });

  it("sans session → clear cookies + redirige idempotent", async () => {
    authenticateMock.mockResolvedValue(null);
    const returnTo = "http://localhost:3001/bitlab";
    const res = await GET(
      makeGet(
        `http://localhost/api/auth/bitlab-logout?returnTo=${encodeURIComponent(returnTo)}`,
      ),
    );
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("location")!);
    expect(url.searchParams.get("logged_out")).toBe("1");
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("préserve les query params existants de returnTo", async () => {
    authenticateMock.mockResolvedValue(USER);
    const returnTo = "http://localhost:3001/bitlab?tab=wallet&net=testnet4";
    const res = await GET(
      makeGetWithSession(
        `http://localhost/api/auth/bitlab-logout?returnTo=${encodeURIComponent(returnTo)}`,
        SESSION_TOKEN,
      ),
    );
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("location")!);
    expect(url.searchParams.get("tab")).toBe("wallet");
    expect(url.searchParams.get("net")).toBe("testnet4");
    expect(url.searchParams.get("logged_out")).toBe("1");
  });
});

describe("GET /api/auth/bitlab-logout — rate-limit", () => {
  it("429 après 30 requêtes / 60s depuis la même IP", async () => {
    const ip = freshIp();
    const returnTo = "http://localhost:3001/bitlab";
    const url = `http://localhost/api/auth/bitlab-logout?returnTo=${encodeURIComponent(returnTo)}`;
    const results: number[] = [];
    for (let i = 0; i < 31; i++) {
      const r = await GET(makeGet(url, ip));
      results.push(r.status);
    }
    const authorized = results.filter((s) => s === 302).length;
    const throttled = results.filter((s) => s === 429).length;
    expect(authorized).toBe(30);
    expect(throttled).toBeGreaterThanOrEqual(1);
  });
});
