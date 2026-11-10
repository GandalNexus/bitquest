import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const queryRawMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: (...args: unknown[]) => queryRawMock(...args) },
}));

import { getHealthStatus, HEALTH_DEGRADED_MS } from "./health";

beforeEach(() => {
  queryRawMock.mockReset();
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
});
