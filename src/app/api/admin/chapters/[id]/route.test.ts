/**
 * Tests de /api/admin/chapters/[id] (PATCH + DELETE).
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
  chapter: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  lesson: { count: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { PATCH, DELETE } from "./route";

const EDITOR = { id: "ed-1", pseudo: "ed", role: "EDITOR", token: "tk" };
const EXISTING = {
  id: "ch-1",
  courseId: "course-1",
  slug: "intro",
  title: "Intro",
};

function makeReq(method: "PATCH" | "DELETE", body?: unknown): Request {
  return new Request("http://localhost/api/admin/chapters/ch-1", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = Promise.resolve({ id: "ch-1" });

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.chapter.findUnique.mockReset();
  dbMock.chapter.update.mockReset();
  dbMock.chapter.delete.mockReset();
  dbMock.lesson.count.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/chapters/[id]", () => {
  it("401 si non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { title: "X" }), { params });
    expect(res.status).toBe(401);
  });

  it("404 si chapitre introuvable", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.chapter.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { title: "X" }), { params });
    expect(res.status).toBe(404);
  });

  it("409 si slug change collide dans le même cours", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.chapter.findUnique
      .mockResolvedValueOnce(EXISTING) // lookup par id
      .mockResolvedValueOnce({ id: "other", slug: "autre" }); // courseId_slug
    const res = await PATCH(makeReq("PATCH", { slug: "autre" }), { params });
    expect(res.status).toBe(409);
  });

  it("200 succès + CHAPTER_UPDATE loggé", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.chapter.findUnique.mockResolvedValue(EXISTING);
    dbMock.chapter.update.mockResolvedValue({ ...EXISTING, title: "New" });
    const res = await PATCH(makeReq("PATCH", { title: "New" }), { params });
    expect(res.status).toBe(200);
    expect(dbMock.adminAuditLog.create).toHaveBeenCalledOnce();
    const args = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(args.data.action).toBe("CHAPTER_UPDATE");
  });
});

describe("DELETE /api/admin/chapters/[id]", () => {
  it("409 si des leçons sont encore liées", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.lesson.count.mockResolvedValue(2);
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(409);
    expect(dbMock.chapter.delete).not.toHaveBeenCalled();
  });

  it("200 succès si zéro leçon + CHAPTER_DELETE loggé", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.lesson.count.mockResolvedValue(0);
    dbMock.chapter.findUnique.mockResolvedValue({
      slug: EXISTING.slug,
      title: EXISTING.title,
      courseId: EXISTING.courseId,
    });
    dbMock.chapter.delete.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(200);
    expect(dbMock.chapter.delete).toHaveBeenCalledOnce();
    const args = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(args.data.action).toBe("CHAPTER_DELETE");
  });

  it("404 si delete throw (chapitre disparu)", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.lesson.count.mockResolvedValue(0);
    dbMock.chapter.findUnique.mockResolvedValue(null);
    dbMock.chapter.delete.mockRejectedValue(new Error("Record to delete does not exist"));
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(404);
  });
});
