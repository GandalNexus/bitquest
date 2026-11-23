/**
 * Tests de /api/admin/quests/[code] (PATCH + DELETE).
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
  quest: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  chapterQuest: { count: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { PATCH, DELETE } from "./route";

const EDITOR = { id: "ed-1", pseudo: "ed", role: "EDITOR", token: "tk" };
const EXISTING = { id: "quest-1", code: "tx-basics", title: "Les bases" };

function makeReq(method: "PATCH" | "DELETE", body?: unknown): Request {
  return new Request("http://localhost/api/admin/quests/tx-basics", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = Promise.resolve({ code: "tx-basics" });

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.quest.findUnique.mockReset();
  dbMock.quest.update.mockReset();
  dbMock.quest.delete.mockReset();
  dbMock.chapterQuest.count.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/quests/[code]", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { title: "X" }), { params });
    expect(res.status).toBe(401);
  });

  it("404 si quête introuvable", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.quest.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { title: "X" }), { params });
    expect(res.status).toBe(404);
  });

  it("200 succès + QUEST_UPDATE loggé", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.quest.findUnique.mockResolvedValue(EXISTING);
    dbMock.quest.update.mockResolvedValue({ ...EXISTING, title: "New" });
    const res = await PATCH(makeReq("PATCH", { title: "New" }), { params });
    expect(res.status).toBe(200);
    const args = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(args.data.action).toBe("QUEST_UPDATE");
  });
});

describe("DELETE /api/admin/quests/[code]", () => {
  it("404 si quête introuvable", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.quest.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(404);
  });

  it("409 si des chapitres sont encore liés (ChapterQuest onDelete: Restrict)", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.quest.findUnique.mockResolvedValue(EXISTING);
    dbMock.chapterQuest.count.mockResolvedValue(2);
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(409);
    expect(dbMock.quest.delete).not.toHaveBeenCalled();
  });

  it("200 succès + QUEST_DELETE loggé si aucun chapitre lié", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.quest.findUnique.mockResolvedValue(EXISTING);
    dbMock.chapterQuest.count.mockResolvedValue(0);
    dbMock.quest.delete.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(200);
    expect(dbMock.quest.delete).toHaveBeenCalledWith({ where: { id: EXISTING.id } });
    const args = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string; resource: string };
    };
    expect(args.data.action).toBe("QUEST_DELETE");
    expect(args.data.resource).toBe("quest:quest-1");
  });
});
