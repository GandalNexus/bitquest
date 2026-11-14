/**
 * Tests de /api/admin/users/[id]/role (POST).
 *
 * Scénarios :
 *   - 401 si non authentifié.
 *   - 403 si rôle insuffisant (APPRENTICE / EDITOR).
 *   - 400 si Zod invalide (role inconnu).
 *   - 404 si target introuvable.
 *   - 400 auto-démotion (admin ne peut pas se retirer ADMIN).
 *   - 200 unchanged si target a déjà le rôle demandé.
 *   - 200 succès : target.role mis à jour + token rotés + audit loggé.
 *
 * Mocks : `authenticate` + `db` + `logAdminAction` — zéro réseau, zéro DB.
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
  user: { findUnique: vi.fn(), update: vi.fn() },
  userEvent: { create: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST } from "./route";

const ADMIN_ACTOR = {
  id: "admin-1",
  pseudo: "root",
  role: "ADMIN",
  token: "admin-token",
};
const TARGET_USER = {
  id: "user-42",
  pseudo: "alice",
  role: "APPRENTICE",
  token: "alice-token",
};

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/users/user-42/role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: TARGET_USER.id });

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.user.findUnique.mockReset();
  dbMock.user.update.mockReset();
  dbMock.userEvent.create.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.userEvent.create.mockResolvedValue({});
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/users/[id]/role — gardes", () => {
  it("401 si non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await POST(makeReq({ role: "EDITOR" }), { params });
    expect(res.status).toBe(401);
  });

  it("403 si rôle actor insuffisant (EDITOR)", async () => {
    authenticateMock.mockResolvedValue({ ...ADMIN_ACTOR, role: "EDITOR" });
    const res = await POST(makeReq({ role: "EDITOR" }), { params });
    expect(res.status).toBe(403);
  });

  it("400 si body Zod invalide (role inconnu)", async () => {
    authenticateMock.mockResolvedValue(ADMIN_ACTOR);
    const res = await POST(makeReq({ role: "GOD_MODE" }), { params });
    expect(res.status).toBe(400);
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("404 si target introuvable", async () => {
    authenticateMock.mockResolvedValue(ADMIN_ACTOR);
    dbMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ role: "EDITOR" }), { params });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/users/[id]/role — métier", () => {
  it("400 auto-démotion (actor essaie de se retirer ADMIN)", async () => {
    authenticateMock.mockResolvedValue(ADMIN_ACTOR);
    dbMock.user.findUnique.mockResolvedValue(ADMIN_ACTOR);
    const selfParams = Promise.resolve({ id: ADMIN_ACTOR.id });
    const res = await POST(makeReq({ role: "APPRENTICE" }), { params: selfParams });
    expect(res.status).toBe(400);
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("200 unchanged si rôle inchangé (short-circuit)", async () => {
    authenticateMock.mockResolvedValue(ADMIN_ACTOR);
    dbMock.user.findUnique.mockResolvedValue({ ...TARGET_USER, role: "EDITOR" });
    const res = await POST(makeReq({ role: "EDITOR" }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unchanged).toBe(true);
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("200 succès : target.role rôle mis à jour + token roté + audit loggé", async () => {
    authenticateMock.mockResolvedValue(ADMIN_ACTOR);
    dbMock.user.findUnique.mockResolvedValue(TARGET_USER);
    dbMock.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...TARGET_USER,
      role: data.role,
      token: data.token,
    }));

    const res = await POST(makeReq({ role: "EDITOR" }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user.role).toBe("EDITOR");

    expect(dbMock.user.update).toHaveBeenCalledOnce();
    const updateArgs = dbMock.user.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { role: string; token: string };
    };
    expect(updateArgs.where.id).toBe(TARGET_USER.id);
    expect(updateArgs.data.role).toBe("EDITOR");
    // Token roté (différent de l'ancien) et longueur hex non vide.
    expect(updateArgs.data.token).not.toBe(TARGET_USER.token);
    expect(updateArgs.data.token.length).toBeGreaterThanOrEqual(32);

    expect(dbMock.adminAuditLog.create).toHaveBeenCalledOnce();
    const auditArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string; resource: string };
    };
    expect(auditArgs.data.action).toBe("ROLE_CHANGE");
    expect(auditArgs.data.resource).toBe(`user:${TARGET_USER.id}`);
  });
});
