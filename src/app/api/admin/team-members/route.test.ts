/**
 * Tests de /api/admin/team-members (POST, ADMIN only).
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
  teamMember: { create: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST } from "./route";

const ADMIN = { id: "admin-1", pseudo: "root", role: "ADMIN", token: "tk" };
const EDITOR = { id: "ed-1", pseudo: "ed", role: "EDITOR", token: "tk2" };

const VALID = {
  name: "Alhassane Diallo",
  role: "Lead ingénieur · architecte",
  contribution: "Design système, auth, protocole BitQuest ↔ BitLab.",
  initials: "ad",
  avatarUrl: null,
  order: 0,
  publishedAt: null,
};

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/team-members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.teamMember.create.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/team-members", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(401);
  });

  it("403 EDITOR refusé (team = ADMIN only)", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(403);
  });

  it("400 Zod : initials trop longues", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    const res = await POST(makeReq({ ...VALID, initials: "TOOLONG" }));
    expect(res.status).toBe(400);
  });

  it("400 Zod : avatarUrl malformée", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    const res = await POST(makeReq({ ...VALID, avatarUrl: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("201 succès + initials uppercase + audit TEAM_MEMBER_CREATE", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.teamMember.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "member-1",
      ...data,
    }));
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(201);
    const createArgs = dbMock.teamMember.create.mock.calls[0]?.[0] as {
      data: { initials: string; avatarUrl: string | null };
    };
    // Normalisation uppercase côté route.
    expect(createArgs.data.initials).toBe("AD");
    expect(createArgs.data.avatarUrl).toBeNull();

    const auditArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(auditArgs.data.action).toBe("TEAM_MEMBER_CREATE");
  });
});
