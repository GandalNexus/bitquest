import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { adminAuditLog: { create: (...args: unknown[]) => createMock(...args) } },
}));

import { logAdminAction } from "./audit";

beforeEach(() => {
  createMock.mockReset();
});

describe("logAdminAction", () => {
  it("écrit une entrée avec les champs attendus et sérialise meta en JSON", async () => {
    createMock.mockResolvedValueOnce({});
    await logAdminAction("actor-1", "COURSE_CREATE", "course:abc", {
      slug: "foo",
      title: "Foo",
    });
    expect(createMock).toHaveBeenCalledWith({
      data: {
        actorId: "actor-1",
        action: "COURSE_CREATE",
        resource: "course:abc",
        meta: JSON.stringify({ slug: "foo", title: "Foo" }),
      },
    });
  });

  it("utilise {} si meta omis", async () => {
    createMock.mockResolvedValueOnce({});
    await logAdminAction("actor-2", "ROLE_CHANGE", "user:xyz");
    const call = createMock.mock.calls[0][0];
    expect(JSON.parse(call.data.meta)).toEqual({});
  });

  it("n'avale pas l'exception mais ne la relance pas", async () => {
    createMock.mockRejectedValueOnce(new Error("boom"));
    // Le logger pino écrit sur stdout — on vérifie juste la promesse résolue.
    await expect(
      logAdminAction("actor-3", "LESSON_DELETE", "lesson:x", { why: "orphan" }),
    ).resolves.toBeUndefined();
    expect(createMock).toHaveBeenCalledOnce();
  });

  it("gère un meta avec valeurs non primitives (serialisation JSON)", async () => {
    createMock.mockResolvedValueOnce({});
    await logAdminAction("a", "CHAPTER_UPDATE", "chapter:1", {
      changedFields: ["title", "summary"],
    });
    const call = createMock.mock.calls[0][0];
    const parsed = JSON.parse(call.data.meta);
    expect(parsed.changedFields).toEqual(["title", "summary"]);
  });
});
