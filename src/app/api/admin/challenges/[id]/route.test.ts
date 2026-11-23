/**
 * Tests de /api/admin/challenges/[id] (PATCH + DELETE, ADMIN).
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
  dailyChallenge: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dailyChallengeCompletion: { count: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { PATCH, DELETE } from "./route";

const ADMIN = { id: "admin-1", pseudo: "root", role: "ADMIN", token: "tk" };
const EXISTING = { id: "ch-1", date: "2026-12-01", title: "Lightning" };

function makeReq(method: "PATCH" | "DELETE", path = "/api/admin/challenges/ch-1", body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = Promise.resolve({ id: "ch-1" });

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.dailyChallenge.findUnique.mockReset();
  dbMock.dailyChallenge.update.mockReset();
  dbMock.dailyChallenge.delete.mockReset();
  dbMock.dailyChallengeCompletion.count.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/challenges/[id]", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", undefined, { title: "X" }), { params });
    expect(res.status).toBe(401);
  });

  it("404 si défi introuvable", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.dailyChallenge.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", undefined, { title: "X" }), { params });
    expect(res.status).toBe(404);
  });

  it("409 si date change collide avec un autre défi", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.dailyChallenge.findUnique
      .mockResolvedValueOnce(EXISTING)
      .mockResolvedValueOnce({ id: "other", date: "2026-12-05" });
    const res = await PATCH(makeReq("PATCH", undefined, { date: "2026-12-05" }), { params });
    expect(res.status).toBe(409);
  });

  it("200 succès + CHALLENGE_UPDATE loggé", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.dailyChallenge.findUnique.mockResolvedValue(EXISTING);
    dbMock.dailyChallenge.update.mockResolvedValue({ ...EXISTING, title: "New" });
    const res = await PATCH(makeReq("PATCH", undefined, { title: "New" }), { params });
    expect(res.status).toBe(200);
    const args = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(args.data.action).toBe("CHALLENGE_UPDATE");
  });
});

describe("DELETE /api/admin/challenges/[id]", () => {
  it("409 si validations existent et pas de ?force=true", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.dailyChallenge.findUnique.mockResolvedValue(EXISTING);
    dbMock.dailyChallengeCompletion.count.mockResolvedValue(3);
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.completionsCount).toBe(3);
    expect(dbMock.dailyChallenge.delete).not.toHaveBeenCalled();
  });

  it("200 force=true supprime en cascade + audit forced", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.dailyChallenge.findUnique.mockResolvedValue(EXISTING);
    dbMock.dailyChallengeCompletion.count.mockResolvedValue(3);
    dbMock.dailyChallenge.delete.mockResolvedValue({});
    const res = await DELETE(
      makeReq("DELETE", "/api/admin/challenges/ch-1?force=true"),
      { params },
    );
    expect(res.status).toBe(200);
    expect(dbMock.dailyChallenge.delete).toHaveBeenCalledOnce();
    const args = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string; meta: string };
    };
    expect(args.data.action).toBe("CHALLENGE_DELETE");
    expect(JSON.parse(args.data.meta).forced).toBe(true);
  });

  it("200 delete trivial si aucune validation", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.dailyChallenge.findUnique.mockResolvedValue(EXISTING);
    dbMock.dailyChallengeCompletion.count.mockResolvedValue(0);
    dbMock.dailyChallenge.delete.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(200);
  });
});
