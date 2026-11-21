/**
 * Tests unitaires `launch-token.ts` — LOT 2 (SSO léger GandalNexus).
 *
 * Verrouille :
 *   - Émission : claims attendues, TTL respecté, v: PROTOCOL_VERSION.
 *   - Vérification : signature invalide rejetée, v > current rejeté,
 *     nonce consommé (Redis SET NX), replay bloqué.
 *   - Audience discriminée : un mission challenge (aud=bitlab) NE DOIT PAS
 *     passer pour un launch token (aud=bitlab-user).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
}));
const getRedisMock = vi.hoisted(() => vi.fn());
const isRedisStrictMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cache/redis", () => ({
  getRedis: () => getRedisMock(),
  isRedisStrict: () => isRedisStrictMock(),
}));

import {
  issueLaunchToken,
  verifyLaunchToken,
  verifyLaunchTokenOrRespond,
  issueSessionToken,
  verifySessionToken,
  verifySessionFromRequest,
  LAUNCH_TOKEN_TTL_SECONDS,
  SESSION_TOKEN_TTL,
} from "./launch-token";
import { PROTOCOL_VERSION } from "@/lib/bitlab/protocol";

const SECRET = "test-launch-secret-at-least-32-bytes-long";

beforeEach(() => {
  process.env.BITLAB_LAUNCH_SECRET = SECRET;
  redisMock.set.mockReset();
  redisMock.set.mockResolvedValue("OK");
  getRedisMock.mockReset();
  getRedisMock.mockResolvedValue(redisMock);
  isRedisStrictMock.mockReset();
  isRedisStrictMock.mockReturnValue(false);
});

describe("issueLaunchToken", () => {
  it("émet un JWT avec v: PROTOCOL_VERSION + TTL par défaut", async () => {
    const before = Math.floor(Date.now() / 1000);
    const { token, expiresAt, nonce } = await issueLaunchToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
      email: "alice@example.com",
      emailVerifiedAt: new Date(),
    });
    expect(token.split(".")).toHaveLength(3);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const delta = Math.floor(expiresAt.getTime() / 1000) - before;
    expect(delta).toBeGreaterThanOrEqual(LAUNCH_TOKEN_TTL_SECONDS - 2);
    expect(delta).toBeLessThanOrEqual(LAUNCH_TOKEN_TTL_SECONDS + 2);
  });

  it("verify après issue réussit et retourne les claims", async () => {
    const { token } = await issueLaunchToken({
      userId: "u1",
      pseudo: "alice",
      role: "ADMIN",
      email: null,
      emailVerifiedAt: null,
    });
    const claims = await verifyLaunchToken(token);
    expect(claims.userId).toBe("u1");
    expect(claims.pseudo).toBe("alice");
    expect(claims.role).toBe("ADMIN");
    expect(claims.v).toBe(PROTOCOL_VERSION);
  });
});

describe("verifyLaunchToken — anti-replay", () => {
  it("consomme le nonce via SET NX EX", async () => {
    const { token, nonce } = await issueLaunchToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
      email: null,
      emailVerifiedAt: null,
    });
    await verifyLaunchToken(token);
    expect(redisMock.set).toHaveBeenCalledWith(
      `launch:nonce:${nonce}`,
      "u1",
      "EX",
      600,
      "NX",
    );
  });

  it("rejette un replay (SET NX renvoie null)", async () => {
    const { token } = await issueLaunchToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
      email: null,
      emailVerifiedAt: null,
    });
    redisMock.set.mockResolvedValueOnce("OK");
    await verifyLaunchToken(token); // 1er appel OK
    redisMock.set.mockResolvedValueOnce(null);
    await expect(verifyLaunchToken(token)).rejects.toThrow(/replay/i);
  });

  it("sans Redis + mode permissif : anti-replay désactivé (dev) mais signature toujours vérifiée", async () => {
    getRedisMock.mockResolvedValue(null);
    isRedisStrictMock.mockReturnValue(false);
    const { token } = await issueLaunchToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
      email: null,
      emailVerifiedAt: null,
    });
    const claims = await verifyLaunchToken(token);
    expect(claims.userId).toBe("u1");
  });

  it("sans Redis + mode strict : refuse (fail-closed prod)", async () => {
    getRedisMock.mockResolvedValue(null);
    isRedisStrictMock.mockReturnValue(true);
    const { token } = await issueLaunchToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
      email: null,
      emailVerifiedAt: null,
    });
    await expect(verifyLaunchToken(token)).rejects.toThrow(/anti-replay indisponible/i);
  });
});

describe("verifyLaunchToken — anti-downgrade / anti-mistake-aud", () => {
  it("rejette un token avec v > PROTOCOL_VERSION", async () => {
    const forged = await new SignJWT({
      v: PROTOCOL_VERSION + 1,
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
      email: null,
      emailVerified: false,
      nonce: "a".repeat(22),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("bitquest")
      .setAudience("bitlab-user")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifyLaunchToken(forged)).rejects.toThrow(/version/i);
  });

  it("rejette un mission challenge (aud=bitlab) : audience mismatch", async () => {
    // Forge un token qui ressemble à un challenge de preuve (aud=bitlab).
    const forged = await new SignJWT({
      v: PROTOCOL_VERSION,
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: "b".repeat(22),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("bitquest")
      .setAudience("bitlab") // ← audience du mission challenge, pas du launch
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifyLaunchToken(forged)).rejects.toThrow();
  });

  it("rejette un token signé avec un mauvais secret", async () => {
    const forged = await new SignJWT({
      v: PROTOCOL_VERSION,
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
      email: null,
      emailVerified: false,
      nonce: "c".repeat(22),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("bitquest")
      .setAudience("bitlab-user")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(new TextEncoder().encode("WRONG-SECRET"));
    await expect(verifyLaunchToken(forged)).rejects.toThrow();
  });
});

describe("issueSessionToken / verifySessionToken — LOT final", () => {
  it("émet un JWT HS256 avec TTL 2h par défaut", async () => {
    const before = Math.floor(Date.now() / 1000);
    const { token, expiresAt } = await issueSessionToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
    });
    expect(token.split(".")).toHaveLength(3);
    const delta = Math.floor(expiresAt.getTime() / 1000) - before;
    expect(delta).toBeGreaterThanOrEqual(SESSION_TOKEN_TTL - 2);
    expect(delta).toBeLessThanOrEqual(SESSION_TOKEN_TTL + 2);
  });

  it("verify retourne les claims (pas de nonce check, usage multiple)", async () => {
    const { token } = await issueSessionToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
    });
    const a = await verifySessionToken(token);
    expect(a.userId).toBe("u1");
    // Deuxième appel OK aussi (vs launch_token single-use).
    const b = await verifySessionToken(token);
    expect(b.userId).toBe("u1");
  });

  it("rejette un launch token (aud=bitlab-user) comme session (aud=bitlab-user)", async () => {
    const { token } = await issueLaunchToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
      email: null,
      emailVerifiedAt: null,
    });
    await expect(verifySessionToken(token)).rejects.toThrow();
  });

  it("rejette version v > PROTOCOL_VERSION", async () => {
    const forged = await new SignJWT({
      v: PROTOCOL_VERSION + 1,
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("bitquest")
      .setAudience("bitlab-session")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 7200)
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifySessionToken(forged)).rejects.toThrow(/version/i);
  });

  it("verifySessionFromRequest extrait le Bearer et vérifie", async () => {
    const { token } = await issueSessionToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
    });
    const req = new Request("http://localhost/x", {
      headers: { authorization: `Bearer ${token}` },
    });
    const claims = await verifySessionFromRequest(req);
    expect(claims?.userId).toBe("u1");
  });

  it("verifySessionFromRequest retourne null sans header / avec header mal formé", async () => {
    expect(await verifySessionFromRequest(new Request("http://localhost/x"))).toBeNull();
    const req = new Request("http://localhost/x", {
      headers: { authorization: "Basic abc" },
    });
    expect(await verifySessionFromRequest(req)).toBeNull();
  });

  it("verifySessionFromRequest retourne null sur token invalide", async () => {
    const req = new Request("http://localhost/x", {
      headers: { authorization: "Bearer bogus.not.a-jwt" },
    });
    expect(await verifySessionFromRequest(req)).toBeNull();
  });
});

describe("verifyLaunchTokenOrRespond — helper Response", () => {
  it("wrap les erreurs en Response 400 formatée", async () => {
    const res = await verifyLaunchTokenOrRespond("not-a-jwt");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.status).toBe(400);
    }
  });

  it("retourne les claims sur succès", async () => {
    const { token } = await issueLaunchToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
      email: null,
      emailVerifiedAt: null,
    });
    const res = await verifyLaunchTokenOrRespond(token);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.claims.userId).toBe("u1");
  });
});
