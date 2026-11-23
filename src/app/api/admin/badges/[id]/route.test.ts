/**
 * Tests de /api/admin/badges/[id] (PATCH + DELETE, ADMIN uniquement).
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
  badge: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  userBadge: { count: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { PATCH, DELETE } from "./route";

const ADMIN = { id: "admin-1", pseudo: "root", role: "ADMIN", token: "tk" };
const EXISTING = { id: "badge-1", code: "first-quest", name: "Trophy" };

function makeReq(method: "PATCH" | "DELETE", path = "/api/admin/badges/badge-1", body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = Promise.resolve({ id: "badge-1" });

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.badge.findUnique.mockReset();
  dbMock.badge.update.mockReset();
  dbMock.badge.delete.mockReset();
  dbMock.userBadge.count.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/badges/[id]", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", undefined, { name: "X" }), { params });
    expect(res.status).toBe(401);
  });

  it("404 si badge introuvable", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.badge.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", undefined, { name: "X" }), { params });
    expect(res.status).toBe(404);
  });

  it("200 succès + BADGE_UPDATE loggé + conditionValue re-sérialisé", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.badge.findUnique.mockResolvedValue(EXISTING);
    dbMock.badge.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...EXISTING,
      ...data,
    }));
    const res = await PATCH(
      makeReq("PATCH", undefined, { conditionValue: { questCode: "utxo" } }),
      { params },
    );
    expect(res.status).toBe(200);

    const updateArgs = dbMock.badge.update.mock.calls[0]?.[0] as {
      data: { conditionValue: string };
    };
    expect(typeof updateArgs.data.conditionValue).toBe("string");
    expect(JSON.parse(updateArgs.data.conditionValue)).toEqual({ questCode: "utxo" });

    const auditArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(auditArgs.data.action).toBe("BADGE_UPDATE");
  });
});

describe("DELETE /api/admin/badges/[id]", () => {
  it("404 si badge introuvable", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.badge.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(404);
  });

  it("409 si badge déjà obtenu par des users et pas de ?force=true", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.badge.findUnique.mockResolvedValue(EXISTING);
    dbMock.userBadge.count.mockResolvedValue(5);
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.earnedCount).toBe(5);
    expect(dbMock.badge.delete).not.toHaveBeenCalled();
  });

  it("200 force=true delete même si earnedCount > 0 + BADGE_DELETE loggé", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.badge.findUnique.mockResolvedValue(EXISTING);
    dbMock.userBadge.count.mockResolvedValue(5);
    dbMock.badge.delete.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE", "/api/admin/badges/badge-1?force=true"), {
      params,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.earnedCount).toBe(5);
    expect(dbMock.badge.delete).toHaveBeenCalledOnce();

    const auditArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string; meta: string };
    };
    expect(auditArgs.data.action).toBe("BADGE_DELETE");
    expect(JSON.parse(auditArgs.data.meta).forced).toBe(true);
  });

  it("200 delete trivial si pas de user affecté", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.badge.findUnique.mockResolvedValue(EXISTING);
    dbMock.userBadge.count.mockResolvedValue(0);
    dbMock.badge.delete.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(200);
    expect(dbMock.badge.delete).toHaveBeenCalledOnce();
  });
});
