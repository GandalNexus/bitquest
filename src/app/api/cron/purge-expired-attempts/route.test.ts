/**
 * Tests cron purge-expired-attempts.
 * - 503 si CRON_SECRET absent ou trop court.
 * - 401 si header manquant ou mauvais.
 * - 200 avec count si bon secret.
 * - 405 sur GET.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const expireMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bitlab/attempt", () => ({ expireStaleAttempts: expireMock }));

import { GET, POST } from "./route";

const GOOD_SECRET = "s".repeat(32);

function makePost(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers["x-cron-secret"] = secret;
  return new Request("http://localhost/api/cron/purge-expired-attempts", {
    method: "POST",
    headers,
  });
}

let originalSecret: string | undefined;

beforeEach(() => {
  originalSecret = process.env.CRON_SECRET;
  expireMock.mockReset();
  expireMock.mockResolvedValue(3);
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  vi.clearAllMocks();
});

describe("POST /api/cron/purge-expired-attempts", () => {
  it("503 si CRON_SECRET absent", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makePost(GOOD_SECRET));
    expect(res.status).toBe(503);
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("503 si CRON_SECRET < 16 chars", async () => {
    process.env.CRON_SECRET = "short";
    const res = await POST(makePost("short"));
    expect(res.status).toBe(503);
  });

  it("401 si header x-cron-secret manquant", async () => {
    process.env.CRON_SECRET = GOOD_SECRET;
    const res = await POST(makePost());
    expect(res.status).toBe(401);
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("401 si header x-cron-secret incorrect", async () => {
    process.env.CRON_SECRET = GOOD_SECRET;
    const res = await POST(makePost("w".repeat(32)));
    expect(res.status).toBe(401);
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("401 si header de longueur différente (pas d'oracle)", async () => {
    process.env.CRON_SECRET = GOOD_SECRET;
    const res = await POST(makePost("s".repeat(16)));
    expect(res.status).toBe(401);
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("200 avec count quand bon secret", async () => {
    process.env.CRON_SECRET = GOOD_SECRET;
    const res = await POST(makePost(GOOD_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.expired).toBe(3);
    expect(typeof body.elapsedMs).toBe("number");
    expect(expireMock).toHaveBeenCalledOnce();
  });

  it("200 même si 0 attempts expirés (idempotent)", async () => {
    process.env.CRON_SECRET = GOOD_SECRET;
    expireMock.mockResolvedValueOnce(0);
    const res = await POST(makePost(GOOD_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(0);
  });
});

describe("GET /api/cron/purge-expired-attempts", () => {
  it("405", () => {
    const res = GET();
    expect(res.status).toBe(405);
  });
});
