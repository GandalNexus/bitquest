/**
 * Tests de /api/admin/challenges (POST — création défi, ADMIN uniquement).
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
  dailyChallenge: { findUnique: vi.fn(), create: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST } from "./route";

const ADMIN = { id: "admin-1", pseudo: "root", role: "ADMIN", token: "tk" };
const EDITOR = { id: "ed-1", pseudo: "ed", role: "EDITOR", token: "tk2" };

const VALID = {
  date: "2026-12-01",
  title: "Lightning check",
  prompt: "Ouvre un canal sur testnet et note son short_channel_id.",
  xpReward: 25,
  satsReward: 100,
};

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/challenges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.dailyChallenge.findUnique.mockReset();
  dbMock.dailyChallenge.create.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/challenges", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(401);
  });

  it("403 EDITOR refusé (challenges = ADMIN only)", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(403);
  });

  it("400 Zod : date invalide", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    const res = await POST(makeReq({ ...VALID, date: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  it("409 si un défi existe déjà pour cette date", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.dailyChallenge.findUnique.mockResolvedValue({ id: "existing", date: VALID.date });
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(409);
  });

  it("201 succès + CHALLENGE_CREATE loggé", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.dailyChallenge.findUnique.mockResolvedValue(null);
    dbMock.dailyChallenge.create.mockResolvedValue({ id: "ch-1", ...VALID });
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(201);
    const auditArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(auditArgs.data.action).toBe("CHALLENGE_CREATE");
  });
});
