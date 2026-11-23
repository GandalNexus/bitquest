/**
 * Tests de /api/admin/courses/[id] (PATCH + DELETE).
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
  course: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  chapter: { count: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { PATCH, DELETE } from "./route";

const EDITOR = { id: "ed-1", pseudo: "ed", role: "EDITOR", token: "tk" };
const EXISTING = { id: "course-1", slug: "fondamentaux", title: "T", publishedAt: null };

function makeReq(method: "PATCH" | "DELETE", body?: unknown): Request {
  return new Request("http://localhost/api/admin/courses/course-1", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = Promise.resolve({ id: "course-1" });

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.course.findUnique.mockReset();
  dbMock.course.update.mockReset();
  dbMock.course.delete.mockReset();
  dbMock.chapter.count.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/courses/[id]", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { title: "X" }), { params });
    expect(res.status).toBe(401);
  });

  it("404 si cours introuvable", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.course.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { title: "X" }), { params });
    expect(res.status).toBe(404);
  });

  it("409 si slug change collide", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    // Premier findUnique = la row existante par id, deuxième = slug collide.
    dbMock.course.findUnique
      .mockResolvedValueOnce(EXISTING)
      .mockResolvedValueOnce({ id: "other", slug: "autre" });
    const res = await PATCH(makeReq("PATCH", { slug: "autre" }), { params });
    expect(res.status).toBe(409);
    expect(dbMock.course.update).not.toHaveBeenCalled();
  });

  it("200 succès + COURSE_UPDATE loggé", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.course.findUnique.mockResolvedValue(EXISTING);
    dbMock.course.update.mockResolvedValue({ ...EXISTING, title: "New" });
    const res = await PATCH(makeReq("PATCH", { title: "New" }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.course.title).toBe("New");

    expect(dbMock.adminAuditLog.create).toHaveBeenCalledOnce();
    const args = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(args.data.action).toBe("COURSE_UPDATE");
  });
});

describe("DELETE /api/admin/courses/[id]", () => {
  it("409 si chapitres encore rattachés", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.chapter.count.mockResolvedValue(3);
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(409);
    expect(dbMock.course.delete).not.toHaveBeenCalled();
  });

  it("200 succès + COURSE_DELETE loggé", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.chapter.count.mockResolvedValue(0);
    dbMock.course.findUnique.mockResolvedValue({
      slug: EXISTING.slug,
      title: EXISTING.title,
    });
    dbMock.course.delete.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(200);

    expect(dbMock.course.delete).toHaveBeenCalledOnce();
    expect(dbMock.adminAuditLog.create).toHaveBeenCalledOnce();
    const args = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string; resource: string };
    };
    expect(args.data.action).toBe("COURSE_DELETE");
    expect(args.data.resource).toBe("course:course-1");
  });

  it("404 si delete throw (course disparue entre count et delete)", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.chapter.count.mockResolvedValue(0);
    dbMock.course.findUnique.mockResolvedValue(null);
    dbMock.course.delete.mockRejectedValue(new Error("Record to delete does not exist"));
    const res = await DELETE(makeReq("DELETE"), { params });
    expect(res.status).toBe(404);
  });
});
