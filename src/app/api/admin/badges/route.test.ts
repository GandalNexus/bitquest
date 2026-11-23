/**
 * Tests de /api/admin/badges (POST — création badge, ADMIN uniquement).
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
  badge: { findUnique: vi.fn(), create: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST } from "./route";

const ADMIN = { id: "admin-1", pseudo: "root", role: "ADMIN", token: "tk" };
const EDITOR = { id: "ed-1", pseudo: "ed", role: "EDITOR", token: "tk2" };

const VALID = {
  code: "first-quest",
  name: "Premier pas",
  description: "A complété sa première quête.",
  icon: "Trophy",
  rarity: "COMMON",
  conditionType: "QUEST_COMPLETE",
  conditionValue: { questCode: "tx-basics" },
};

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/badges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.badge.findUnique.mockReset();
  dbMock.badge.create.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/badges", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(401);
  });

  it("403 EDITOR refusé (badges = ADMIN only)", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(403);
  });

  it("400 Zod : code non kebab-case", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    const res = await POST(makeReq({ ...VALID, code: "Invalid Code" }));
    expect(res.status).toBe(400);
    expect(dbMock.badge.create).not.toHaveBeenCalled();
  });

  it("400 Zod : rarity inconnue", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    const res = await POST(makeReq({ ...VALID, rarity: "LEGENDARY" }));
    expect(res.status).toBe(400);
  });

  it("409 si code déjà utilisé", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.badge.findUnique.mockResolvedValue({ id: "existing", code: VALID.code });
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(409);
  });

  it("201 succès + audit BADGE_CREATE + conditionValue sérialisé", async () => {
    authenticateMock.mockResolvedValue(ADMIN);
    dbMock.badge.findUnique.mockResolvedValue(null);
    dbMock.badge.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "badge-1",
      ...data,
    }));

    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.badge.code).toBe(VALID.code);

    const createArgs = dbMock.badge.create.mock.calls[0]?.[0] as {
      data: { conditionValue: string };
    };
    // conditionValue doit être une string JSON (pas l'objet brut).
    expect(typeof createArgs.data.conditionValue).toBe("string");
    expect(JSON.parse(createArgs.data.conditionValue)).toEqual(VALID.conditionValue);

    expect(dbMock.adminAuditLog.create).toHaveBeenCalledOnce();
    const auditArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(auditArgs.data.action).toBe("BADGE_CREATE");
  });
});
