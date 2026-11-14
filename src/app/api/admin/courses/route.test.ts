/**
 * Tests de /api/admin/courses (POST — création cours).
 *
 * Scénarios :
 *   - 401 non authentifié
 *   - 403 APPRENTICE refusé (EDITOR+ requis)
 *   - 400 Zod invalide (slug non kebab-case)
 *   - 409 slug déjà utilisé
 *   - 201 succès + audit COURSE_CREATE
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
  course: { findUnique: vi.fn(), create: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST } from "./route";

const EDITOR = { id: "ed-1", pseudo: "ed", role: "EDITOR", token: "tk" };

const VALID_BODY = {
  slug: "bitcoin-fondamentaux",
  title: "Fondamentaux Bitcoin",
  subtitle: "Pour débuter",
  description: "Description longue du cours.",
  coverIcon: "BookOpen",
  order: 0,
  publishedAt: null,
};

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.course.findUnique.mockReset();
  dbMock.course.create.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/courses", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("403 APPRENTICE refusé", async () => {
    authenticateMock.mockResolvedValue({ ...EDITOR, role: "APPRENTICE" });
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("400 Zod : slug non kebab-case", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    const res = await POST(makeReq({ ...VALID_BODY, slug: "Bad Slug!!" }));
    expect(res.status).toBe(400);
    expect(dbMock.course.create).not.toHaveBeenCalled();
  });

  it("409 si slug déjà utilisé", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.course.findUnique.mockResolvedValue({ id: "existing", slug: VALID_BODY.slug });
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(409);
    expect(dbMock.course.create).not.toHaveBeenCalled();
  });

  it("201 succès + audit COURSE_CREATE", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.course.findUnique.mockResolvedValue(null);
    dbMock.course.create.mockResolvedValue({ id: "course-1", ...VALID_BODY });
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.course.slug).toBe(VALID_BODY.slug);

    expect(dbMock.adminAuditLog.create).toHaveBeenCalledOnce();
    const auditArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string; resource: string };
    };
    expect(auditArgs.data.action).toBe("COURSE_CREATE");
    expect(auditArgs.data.resource).toBe("course:course-1");
  });
});
