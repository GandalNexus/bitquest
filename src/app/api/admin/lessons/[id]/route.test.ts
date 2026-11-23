/**
 * Tests de /api/admin/lessons/[id] (PATCH + DELETE).
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
  lesson: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { PATCH, DELETE } from "./route";

const EDITOR = { id: "ed-1", pseudo: "ed", role: "EDITOR", token: "tk" };
const EXISTING = {
  id: "lesson-1",
  chapterId: "ch-1",
  slug: "intro",
  title: "Intro",
};

function makeReq(method: "PATCH" | "DELETE", body?: unknown): Request {
  return new Request("http://localhost/api/admin/lessons/lesson-1", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = Promise.resolve({ id: "lesson-1" });

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.lesson.findUnique.mockReset();
  dbMock.lesson.update.mockReset();
  dbMock.lesson.delete.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/lessons/[id]", () => {
  it("401 si non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { title: "X" }), { params });
    expect(res.status).toBe(401);
  });

  it("404 si leçon introuvable", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.lesson.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { title: "X" }), { params });
    expect(res.status).toBe(404);
  });

  it("409 si slug change collide dans le chapitre", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.lesson.findUnique
      .mockResolvedValueOnce(EXISTING)
      .mockResolvedValueOnce({ id: "other", slug: "autre" });
    const res = await PATCH(makeReq("PATCH", { slug: "autre" }), { params });
    expect(res.status).toBe(409);
  });

  it("200 succès + LESSON_UPDATE loggé + publishedAt converti", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.lesson.findUnique.mockResolvedValue(EXISTING);
    dbMock.lesson.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...EXISTING,
      ...data,
    }));
    const iso = "2026-11-01T10:00:00.000Z";
    const res = await PATCH(makeReq("PATCH", { title: "New", publishedAt: iso }), { params });
    expect(res.status).toBe(200);
    const updateArgs = dbMock.lesson.update.mock.calls[0]?.[0] as {
      data: { publishedAt: Date };
    };
    expect(updateArgs.data.publishedAt).toBeInstanceOf(Date);
    expect((updateArgs.data.publishedAt as Date).toISOString()).toBe(iso);

    const auditArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(auditArgs.data.action).toBe("LESSON_UPDATE");
  });
});

describe("DELETE /api/admin/lessons/[id]", () => {
  it("200 succès + LESSON_DELETE loggé (cascade LessonProgress)", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.lesson.findUnique.mockResolvedValue({
      slug: EXISTING.slug,
      title: EXISTING.title,
      chapterId: EXISTING.chapterId,
    });
    dbMock.lesson.delete.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(200);
    expect(dbMock.lesson.delete).toHaveBeenCalledOnce();
    const args = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(args.data.action).toBe("LESSON_DELETE");
  });

  it("404 si delete throw", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.lesson.findUnique.mockResolvedValue(null);
    dbMock.lesson.delete.mockRejectedValue(new Error("Record to delete does not exist"));
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(404);
  });
});
