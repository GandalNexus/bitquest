/**
 * Tests de /api/admin/team-members/[id] (PATCH + DELETE, ADMIN).
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
  teamMember: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { PATCH, DELETE } from "./route";

const ADMIN = { id: "admin-1", pseudo: "root", role: "ADMIN", token: "tk" };
const EXISTING = {
  id: "member-1",
  name: "Alhassane Diallo",
  role: "Lead",
  contribution: "Everything",
  initials: "AD",
  avatarUrl: null,
  order: 0,
  publishedAt: null as Date | null,
};

function makeReq(method: "PATCH" | "DELETE", body?: unknown): Request {
  return new Request("http://localhost/api/admin/team-members/member-1", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = Promise.resolve({ id: "member-1" });

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.teamMember.findUnique.mockReset();
  dbMock.teamMember.update.mockReset();
  dbMock.teamMember.delete.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/team-members/[id]", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { name: "X" }), { params });
    expect(res.status).toBe(401);
  });

  it("404 si membre introuvable", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.teamMember.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { name: "X" }), { params });
    expect(res.status).toBe(404);
  });

  it("200 succès + publishedAt converti + TEAM_MEMBER_UPDATE loggé", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.teamMember.findUnique.mockResolvedValue(EXISTING);
    dbMock.teamMember.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...EXISTING,
      ...data,
    }));
    const iso = "2026-11-10T09:00:00.000Z";
    const res = await PATCH(
      makeReq("PATCH", { role: "Nouveau rôle", publishedAt: iso }),
      { params },
    );
    expect(res.status).toBe(200);
    const updateArgs = dbMock.teamMember.update.mock.calls[0]?.[0] as {
      data: { publishedAt: Date };
    };
    expect(updateArgs.data.publishedAt).toBeInstanceOf(Date);

    const auditArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(auditArgs.data.action).toBe("TEAM_MEMBER_UPDATE");
  });
});

describe("DELETE /api/admin/team-members/[id]", () => {
  it("404 si membre introuvable", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.teamMember.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(404);
  });

  it("200 succès + TEAM_MEMBER_DELETE loggé", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.teamMember.findUnique.mockResolvedValue({ name: EXISTING.name, role: EXISTING.role });
    dbMock.teamMember.delete.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(200);
    expect(dbMock.teamMember.delete).toHaveBeenCalledWith({ where: { id: "member-1" } });
    const args = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(args.data.action).toBe("TEAM_MEMBER_DELETE");
  });
});
