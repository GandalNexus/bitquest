/**
 * Tests du JWT challenge BitLab — versionnement protocole + anti-replay.
 *
 * Le secret est fixé via BITLAB_JWT_SECRET dans beforeEach. Le client
 * Redis est mocké via @/lib/cache/redis pour piloter la consommation
 * de nonce sans infra.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";

const redisSetMock = vi.fn();
const getRedisMock: ReturnType<typeof vi.fn> = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  getRedis: () => getRedisMock(),
  isRedisStrict: () => false,
}));

import {
  PROTOCOL_VERSION,
  freshNonce,
  issueChallenge,
  verifyChallenge,
  verifyChallengeOrRespond,
} from "./jwt";

const SECRET = "dev-test-secret-at-least-32-bytes-please";

function secretBytes(): Uint8Array {
  return new TextEncoder().encode(SECRET);
}

async function forgeToken(claims: Record<string, unknown>, ttl = 3600): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("bitquest")
    .setAudience("bitlab")
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(secretBytes());
}

const fakeRedisOk = { set: redisSetMock };

beforeEach(() => {
  redisSetMock.mockReset();
  getRedisMock.mockReset();
  process.env.BITLAB_JWT_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.BITLAB_JWT_SECRET;
});

describe("PROTOCOL_VERSION", () => {
  it("est un entier ≥ 1", () => {
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
    expect(PROTOCOL_VERSION).toBeGreaterThanOrEqual(1);
  });
});

describe("freshNonce", () => {
  it("retourne 22 chars base64url uniques", () => {
    const a = freshNonce();
    const b = freshNonce();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a).not.toBe(b);
  });
});

describe("issueChallenge → verifyChallenge (happy path)", () => {
  it("émet un JWT avec v = PROTOCOL_VERSION et le vérifie", async () => {
    getRedisMock.mockResolvedValue(null); // pas de Redis = pas de check nonce
    const payload = {
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    };
    const { token, expiresAt } = await issueChallenge(payload);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const claims = await verifyChallenge(token);
    expect(claims.userId).toBe("u1");
    expect(claims.questCode).toBe("tx-basics");
    expect(claims.kind).toBe("TX");
    expect(claims.nonce).toBe(payload.nonce);
    expect(claims.v).toBe(PROTOCOL_VERSION);
  });
});

describe("verifyChallenge — versionnement", () => {
  beforeEach(() => {
    getRedisMock.mockResolvedValue(null);
  });

  it("accepte un token sans champ v (legacy grace)", async () => {
    const token = await forgeToken({
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });
    const claims = await verifyChallenge(token);
    expect(claims.v).toBeUndefined();
    expect(claims.userId).toBe("u1");
  });

  it("accepte un token avec v = PROTOCOL_VERSION", async () => {
    const token = await forgeToken({
      v: PROTOCOL_VERSION,
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });
    const claims = await verifyChallenge(token);
    expect(claims.v).toBe(PROTOCOL_VERSION);
  });

  it("rejette un token avec v > PROTOCOL_VERSION", async () => {
    const token = await forgeToken({
      v: PROTOCOL_VERSION + 1,
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });
    await expect(verifyChallenge(token)).rejects.toThrow(/non supportée/);
  });

  it("rejette un token avec v = 0 ou négatif", async () => {
    const t0 = await forgeToken({
      v: 0,
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });
    await expect(verifyChallenge(t0)).rejects.toThrow(/invalide/);

    const tNeg = await forgeToken({
      v: -1,
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });
    await expect(verifyChallenge(tNeg)).rejects.toThrow(/invalide/);
  });

  it("rejette un token avec v non entier", async () => {
    const token = await forgeToken({
      v: 1.5,
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });
    await expect(verifyChallenge(token)).rejects.toThrow(/invalide/);
  });
});

describe("verifyChallenge — claims incomplètes", () => {
  beforeEach(() => {
    getRedisMock.mockResolvedValue(null);
  });

  it("rejette sans userId", async () => {
    const token = await forgeToken({
      v: PROTOCOL_VERSION,
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });
    await expect(verifyChallenge(token)).rejects.toThrow(/incomplètes/);
  });

  it("rejette sans nonce", async () => {
    const token = await forgeToken({
      v: PROTOCOL_VERSION,
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
    });
    await expect(verifyChallenge(token)).rejects.toThrow(/incomplètes/);
  });
});

describe("verifyChallenge — anti-replay via Redis", () => {
  it("consomme le nonce via SET NX EX et laisse passer la première fois", async () => {
    getRedisMock.mockResolvedValue(fakeRedisOk);
    redisSetMock.mockResolvedValue("OK"); // SET NX réussit

    const { token } = await issueChallenge({
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });

    await expect(verifyChallenge(token)).resolves.toMatchObject({ userId: "u1" });
    expect(redisSetMock).toHaveBeenCalledWith(
      expect.stringMatching(/^bitlab:nonce:/),
      "u1",
      "EX",
      expect.any(Number),
      "NX",
    );
  });

  it("rejette un replay (SET NX renvoie null la 2e fois)", async () => {
    getRedisMock.mockResolvedValue(fakeRedisOk);
    redisSetMock.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);

    const { token } = await issueChallenge({
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });

    await expect(verifyChallenge(token)).resolves.toMatchObject({ userId: "u1" });
    await expect(verifyChallenge(token)).rejects.toThrow(/déjà consommé/);
  });
});

describe("verifyChallenge — signature & expiry", () => {
  beforeEach(() => {
    getRedisMock.mockResolvedValue(null);
  });

  it("rejette une signature altérée", async () => {
    const { token } = await issueChallenge({
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });
    const tampered = token.slice(0, -4) + "XXXX";
    await expect(verifyChallenge(tampered)).rejects.toThrow();
  });

  it("rejette un JWT expiré", async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const token = await new SignJWT({
      v: PROTOCOL_VERSION,
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("bitquest")
      .setAudience("bitlab")
      .setIssuedAt(past - 3600)
      .setExpirationTime(past)
      .sign(secretBytes());

    await expect(verifyChallenge(token)).rejects.toThrow();
  });
});

describe("verifyChallengeOrRespond", () => {
  it("retourne ok=true + claims en cas de succès", async () => {
    getRedisMock.mockResolvedValue(null);
    const { token } = await issueChallenge({
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      nonce: freshNonce(),
    });
    const result = await verifyChallengeOrRespond(token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.claims.userId).toBe("u1");
  });

  it("retourne ok=false + Response 400 en cas d'échec", async () => {
    getRedisMock.mockResolvedValue(null);
    const result = await verifyChallengeOrRespond("not.a.jwt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error).toBeTruthy();
    }
  });
});
