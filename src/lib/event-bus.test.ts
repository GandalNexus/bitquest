import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAll, emit, on } from "./event-bus";

afterEach(() => {
  clearAll();
});

describe("event-bus", () => {
  it("appelle un handler avec le payload typé", async () => {
    const handler = vi.fn();
    on("quest.completed", handler);
    await emit("quest.completed", {
      userId: "u1",
      questCode: "tx-basics",
      xpEarned: 100,
      satsEarned: 50,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      userId: "u1",
      questCode: "tx-basics",
      xpEarned: 100,
      satsEarned: 50,
    });
  });

  it("appelle tous les handlers abonnés au même évènement", async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    on("badge.earned", h1);
    on("badge.earned", h2);
    await emit("badge.earned", { userId: "u1", badgeCode: "first-tx" });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("retourne le nombre de handlers appelés", async () => {
    on("lesson.completed", () => {});
    on("lesson.completed", () => {});
    on("lesson.completed", () => {});
    const n = await emit("lesson.completed", { userId: "u1", lessonId: "L1" });
    expect(n).toBe(3);
  });

  it("retourne 0 si aucun handler n'est abonné", async () => {
    const n = await emit("launch-token.issued", { userId: "u1", nonce: "n" });
    expect(n).toBe(0);
  });

  it("un handler qui throw n'empêche pas les autres", async () => {
    const h1 = vi.fn(() => {
      throw new Error("boom");
    });
    const h2 = vi.fn();
    on("badge.earned", h1);
    on("badge.earned", h2);
    await emit("badge.earned", { userId: "u1", badgeCode: "x" });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("un handler async qui reject n'empêche pas les autres", async () => {
    const h1 = vi.fn(async () => {
      throw new Error("async boom");
    });
    const h2 = vi.fn();
    on("mission-attempt.completed", h1);
    on("mission-attempt.completed", h2);
    await emit("mission-attempt.completed", {
      userId: "u1",
      attemptId: "a1",
      questCode: "q",
    });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("fonction de désabonnement retournée par on()", async () => {
    const handler = vi.fn();
    const off = on("quest.completed", handler);
    off();
    await emit("quest.completed", {
      userId: "u1",
      questCode: "q",
      xpEarned: 0,
      satsEarned: 0,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("clearAll() retire tous les handlers de tous les évènements", async () => {
    const h = vi.fn();
    on("quest.completed", h);
    on("badge.earned", h);
    clearAll();
    await emit("quest.completed", {
      userId: "u1",
      questCode: "q",
      xpEarned: 0,
      satsEarned: 0,
    });
    await emit("badge.earned", { userId: "u1", badgeCode: "x" });
    expect(h).not.toHaveBeenCalled();
  });

  it("isole les évènements : un abonnement à A n'est pas déclenché par B", async () => {
    const hA = vi.fn();
    on("quest.completed", hA);
    await emit("badge.earned", { userId: "u1", badgeCode: "x" });
    expect(hA).not.toHaveBeenCalled();
  });
});
