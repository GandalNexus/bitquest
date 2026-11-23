/**
 * Tests de /api/admin/users/[id]/purge (POST).
 *
 * Scénarios :
 *   - 401 non authentifié
 *   - 403 rôle insuffisant
 *   - 404 target introuvable
 *   - 400 auto-purge refusée
 *   - 400 si target pas encore soft-deleted
 *   - 200 : hard delete + nettoyage audit orphelin + USER_PURGE loggé
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
  user: { findUnique: vi.fn(), delete: vi.fn() },
  adminAuditLog: { deleteMany: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST } from "./route";

const ADMIN = { id: "admin-1", pseudo: "root", role: "ADMIN", token: "tk" };
const SOFT_DELETED = {
  id: "user-42",
  pseudo: "alice",
  email: "alice@example.com",
  deletedAt: new Date("2026-01-01"),
};
const ACTIVE = {
  id: "user-99",
  pseudo: "bob",
  email: "bob@example.com",
  deletedAt: null,
};

function makeReq(id = "user-42"): Request {
  return new Request(`http://localhost/api/admin/users/${id}/purge`, {
    method: "POST",
  });
}

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.user.findUnique.mockReset();
  dbMock.user.delete.mockReset();
  dbMock.adminAuditLog.deleteMany.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.deleteMany.mockResolvedValue({ count: 0 });
  dbMock.adminAuditLog.create.mockResolvedValue({});
  dbMock.user.delete.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/users/[id]/purge", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await POST(makeReq(), { params: Promise.resolve({ id: SOFT_DELETED.id }) });
    expect(res.status).toBe(401);
  });

  it("403 rôle insuffisant (EDITOR)", async () => {
    authenticateMock.mockResolvedValue({ ...ADMIN, role: "EDITOR" });
    const res = await POST(makeReq(), { params: Promise.resolve({ id: SOFT_DELETED.id }) });
    expect(res.status).toBe(403);
  });

  it("404 si target introuvable", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq(), { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("400 auto-purge refusée (actor === target)", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.user.findUnique.mockResolvedValue({
      ...SOFT_DELETED,
      id: ADMIN.id,
    });
    const res = await POST(makeReq(ADMIN.id), { params: Promise.resolve({ id: ADMIN.id }) });
    expect(res.status).toBe(400);
    expect(dbMock.user.delete).not.toHaveBeenCalled();
  });

  it("400 si target pas soft-deleted", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.user.findUnique.mockResolvedValue(ACTIVE);
    const res = await POST(makeReq(ACTIVE.id), { params: Promise.resolve({ id: ACTIVE.id }) });
    expect(res.status).toBe(400);
    expect(dbMock.user.delete).not.toHaveBeenCalled();
  });

  it("200 : hard delete + audit USER_PURGE loggé + orphelins nettoyés", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.user.findUnique.mockResolvedValue(SOFT_DELETED);
    dbMock.adminAuditLog.deleteMany.mockResolvedValue({ count: 3 });

    const res = await POST(makeReq(), { params: Promise.resolve({ id: SOFT_DELETED.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.orphanedAuditLogsRemoved).toBe(3);

    expect(dbMock.adminAuditLog.deleteMany).toHaveBeenCalledWith({
      where: { actorId: SOFT_DELETED.id },
    });
    expect(dbMock.user.delete).toHaveBeenCalledWith({ where: { id: SOFT_DELETED.id } });

    expect(dbMock.adminAuditLog.create).toHaveBeenCalledOnce();
    const logArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string; resource: string; actorId: string };
    };
    expect(logArgs.data.action).toBe("USER_PURGE");
    expect(logArgs.data.resource).toBe(`user:${SOFT_DELETED.id}`);
    expect(logArgs.data.actorId).toBe(ADMIN.id);
  });
});
