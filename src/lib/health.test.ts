import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const queryRawMock = vi.fn();
const pingMock = vi.fn();
const getRedisMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: (...args: unknown[]) => queryRawMock(...args) },
}));

vi.mock("@/lib/cache/redis", () => ({
  getRedis: () => getRedisMock(),
}));

import { getHealthStatus, HEALTH_DEGRADED_MS } from "./health";

beforeEach(() => {
  queryRawMock.mockReset();
  pingMock.mockReset();
  getRedisMock.mockReset();
  getRedisMock.mockResolvedValue(null); // Redis skipped par défaut
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getHealthStatus", () => {
  it("retourne status=ok quand la DB répond rapidement", async () => {
    queryRawMock.mockResolvedValueOnce([{ "1": 1 }]);
    const r = await getHealthStatus();
    expect(r.status).toBe("ok");
    expect(r.db.status).toBe("ok");
    expect(r.db.error).toBeNull();
    expect(typeof r.db.latencyMs).toBe("number");
  });

  it("retourne status=down quand la DB jette", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("Can't reach database server"));
    const r = await getHealthStatus();
    expect(r.status).toBe("down");
    expect(r.db.status).toBe("error");
    expect(r.db.latencyMs).toBeNull();
    expect(r.db.error).toContain("database");
  });

  it("retourne status=degraded quand la DB répond > seuil", async () => {
    queryRawMock.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve([{ "1": 1 }]), HEALTH_DEGRADED_MS + 50)),
    );
    const r = await getHealthStatus();
    expect(r.status).toBe("degraded");
    expect(r.db.status).toBe("ok");
    expect(r.db.latencyMs).toBeGreaterThan(HEALTH_DEGRADED_MS);
  }, 10_000);

  it("expose uptime ≥ 0, env et version", async () => {
    queryRawMock.mockResolvedValueOnce([{ "1": 1 }]);
    const r = await getHealthStatus();
    expect(r.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof r.env).toBe("string");
    expect(typeof r.version).toBe("string");
    expect(r.now).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("sérialise error en string même si Prisma jette un non-Error", async () => {
    queryRawMock.mockRejectedValueOnce("string-literal-error");
    const r = await getHealthStatus();
    expect(r.status).toBe("down");
    expect(r.db.error).toBe("string-literal-error");
  });

  it("redis.status=skipped quand getRedis() retourne null (REDIS_URL vide)", async () => {
    queryRawMock.mockResolvedValueOnce([{ "1": 1 }]);
    getRedisMock.mockResolvedValueOnce(null);
    const r = await getHealthStatus();
    expect(r.redis.status).toBe("skipped");
    expect(r.redis.latencyMs).toBeNull();
    expect(r.redis.error).toBeNull();
    expect(r.status).toBe("ok"); // skipped n'est pas une dégradation
  });
});

describe("getHealthStatus — ping Redis", () => {
  it("status=ok quand DB rapide + Redis répond PONG", async () => {
    queryRawMock.mockResolvedValueOnce([{ "1": 1 }]);
    pingMock.mockResolvedValueOnce("PONG");
    getRedisMock.mockResolvedValueOnce({ ping: pingMock });
    const r = await getHealthStatus();
    expect(r.status).toBe("ok");
    expect(r.redis.status).toBe("ok");
    expect(typeof r.redis.latencyMs).toBe("number");
  });

  it("status=degraded quand DB OK mais Redis jette (fallback actif)", async () => {
    queryRawMock.mockResolvedValueOnce([{ "1": 1 }]);
    pingMock.mockRejectedValueOnce(new Error("Connection lost"));
    getRedisMock.mockResolvedValueOnce({ ping: pingMock });
    const r = await getHealthStatus();
    expect(r.status).toBe("degraded");
    expect(r.db.status).toBe("ok");
    expect(r.redis.status).toBe("error");
    expect(r.redis.error).toContain("Connection");
  });

  it("status=degraded quand Redis PONG mais latence > seuil", async () => {
    queryRawMock.mockResolvedValueOnce([{ "1": 1 }]);
    pingMock.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve("PONG"), HEALTH_DEGRADED_MS + 50)),
    );
    getRedisMock.mockResolvedValueOnce({ ping: pingMock });
    const r = await getHealthStatus();
    expect(r.status).toBe("degraded");
    expect(r.redis.status).toBe("ok");
    if (r.redis.status === "ok") {
      expect(r.redis.latencyMs).toBeGreaterThan(HEALTH_DEGRADED_MS);
    }
  }, 10_000);

  it("DB down l'emporte sur l'état Redis (status=down)", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("db down"));
    pingMock.mockResolvedValueOnce("PONG");
    getRedisMock.mockResolvedValueOnce({ ping: pingMock });
    const r = await getHealthStatus();
    expect(r.status).toBe("down");
  });

  it("gère un PING non-PONG comme une erreur", async () => {
    queryRawMock.mockResolvedValueOnce([{ "1": 1 }]);
    pingMock.mockResolvedValueOnce("OK"); // réponse inattendue
    getRedisMock.mockResolvedValueOnce({ ping: pingMock });
    const r = await getHealthStatus();
    expect(r.redis.status).toBe("error");
    expect(r.status).toBe("degraded");
  });
});
