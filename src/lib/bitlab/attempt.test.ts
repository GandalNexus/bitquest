/**
 * Tests unitaires pour `attempt.ts` — LOT 1 intégration unifiée GandalNexus.
 *
 * Mocks `@/lib/db` pour isoler la logique de transition. Vérifie :
 *   - createAttempt : TTL par défaut 2h, override, insert minimal.
 *   - getAttemptForUser : scope userId (anti-IDOR).
 *   - transitionAttempt : machine d'état, expiration, concurrence.
 *   - findLatestActiveAttempt : filtre states + order DESC.
 *   - expireStaleAttempts : batch idempotent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  missionAttempt: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  createAttempt,
  getAttemptForUser,
  transitionAttempt,
  findLatestActiveAttempt,
  expireStaleAttempts,
  snapshotAttemptResult,
  ACTIVE_STATES,
  TERMINAL_STATES,
  DEFAULT_TTL_MS,
} from "./attempt";

function baseRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "a1",
    userId: "u1",
    questId: "q1",
    questCode: "tx-basics",
    kind: "TX",
    network: "testnet4",
    state: "CREATED",
    launchedAt: now,
    expiresAt: new Date(now.getTime() + DEFAULT_TTL_MS),
    completedAt: null,
    abandonedAt: null,
    failedAt: null,
    failReason: null,
    proofId: null,
    resultJson: null,
    returnTo: null,
    ...overrides,
  };
}

beforeEach(() => {
  dbMock.missionAttempt.create.mockReset();
  dbMock.missionAttempt.findFirst.mockReset();
  dbMock.missionAttempt.findMany.mockReset();
  dbMock.missionAttempt.updateMany.mockReset();
});

describe("ACTIVE_STATES / TERMINAL_STATES", () => {
  it("unions couvrent tout l'espace d'état sans chevauchement", () => {
    const all = [...ACTIVE_STATES, ...TERMINAL_STATES];
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual([
      "ABANDONED",
      "COMPLETED",
      "CREATED",
      "EXPIRED",
      "FAILED",
      "IN_PROGRESS",
      "PROOF_PENDING",
      "VERIFYING",
    ]);
  });
});

describe("createAttempt", () => {
  it("insère avec TTL 2h par défaut et state CREATED", async () => {
    const t0 = Date.now();
    dbMock.missionAttempt.create.mockResolvedValue({
      id: "a1",
      expiresAt: new Date(t0 + DEFAULT_TTL_MS),
    });
    const res = await createAttempt({
      userId: "u1",
      questId: "q1",
      questCode: "tx-basics",
      kind: "TX",
      network: "testnet4",
    });
    expect(res.id).toBe("a1");
    const call = dbMock.missionAttempt.create.mock.calls[0][0];
    expect(call.data.state).toBe("CREATED");
    expect(call.data.returnTo).toBe(null);
    const deltaMs = call.data.expiresAt.getTime() - t0;
    expect(deltaMs).toBeGreaterThanOrEqual(DEFAULT_TTL_MS - 1000);
    expect(deltaMs).toBeLessThanOrEqual(DEFAULT_TTL_MS + 1000);
  });

  it("respecte un TTL override et persiste returnTo", async () => {
    dbMock.missionAttempt.create.mockResolvedValue({
      id: "a2",
      expiresAt: new Date(),
    });
    await createAttempt({
      userId: "u1",
      questId: "q1",
      questCode: "tx",
      kind: "TX",
      network: "signet",
      returnTo: "http://quest/x",
      ttlMs: 60_000,
    });
    const call = dbMock.missionAttempt.create.mock.calls[0][0];
    expect(call.data.returnTo).toBe("http://quest/x");
    const delta = call.data.expiresAt.getTime() - Date.now();
    expect(delta).toBeGreaterThanOrEqual(55_000);
    expect(delta).toBeLessThanOrEqual(60_000 + 1000);
  });
});

describe("getAttemptForUser — anti-IDOR", () => {
  it("retourne null si attemptId inexistant", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(null);
    const res = await getAttemptForUser("a1", "u1");
    expect(res).toBeNull();
    const call = dbMock.missionAttempt.findFirst.mock.calls[0][0];
    // Le where DOIT inclure userId pour empêcher un autre user de sonder.
    expect(call.where.userId).toBe("u1");
  });

  it("retourne null si input vide", async () => {
    expect(await getAttemptForUser("", "u1")).toBeNull();
    expect(await getAttemptForUser("a1", "")).toBeNull();
    expect(dbMock.missionAttempt.findFirst).not.toHaveBeenCalled();
  });

  it("sérialise correctement l'état en AttemptState", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(baseRow({ state: "IN_PROGRESS" }));
    const res = await getAttemptForUser("a1", "u1");
    expect(res?.state).toBe("IN_PROGRESS");
  });
});

describe("transitionAttempt — machine d'état", () => {
  it("rejette NOT_FOUND si la row n'existe pas", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(null);
    const res = await transitionAttempt({
      attemptId: "x",
      userId: "u1",
      to: "IN_PROGRESS",
    });
    expect(res).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("marque EXPIRED si expiresAt passé et rejette la transition demandée", async () => {
    const past = new Date(Date.now() - 1000);
    dbMock.missionAttempt.findFirst.mockResolvedValue(
      baseRow({ state: "CREATED", expiresAt: past }),
    );
    dbMock.missionAttempt.updateMany.mockResolvedValue({ count: 1 });
    const res = await transitionAttempt({
      attemptId: "a1",
      userId: "u1",
      to: "IN_PROGRESS",
    });
    expect(res).toEqual({ ok: false, reason: "EXPIRED" });
    const call = dbMock.missionAttempt.updateMany.mock.calls[0][0];
    expect(call.data.state).toBe("EXPIRED");
  });

  it("autorise CREATED → IN_PROGRESS", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(baseRow({ state: "CREATED" }));
    dbMock.missionAttempt.updateMany.mockResolvedValue({ count: 1 });
    const res = await transitionAttempt({
      attemptId: "a1",
      userId: "u1",
      to: "IN_PROGRESS",
    });
    expect(res).toEqual({ ok: true, state: "IN_PROGRESS" });
  });

  it("rejette ILLEGAL_TRANSITION pour COMPLETED → anything", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(baseRow({ state: "COMPLETED" }));
    const res = await transitionAttempt({
      attemptId: "a1",
      userId: "u1",
      to: "IN_PROGRESS",
    });
    expect(res).toEqual({ ok: false, reason: "ILLEGAL_TRANSITION" });
    expect(dbMock.missionAttempt.updateMany).not.toHaveBeenCalled();
  });

  it("empêche les sauts illégaux : CREATED → COMPLETED rejeté", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(baseRow({ state: "CREATED" }));
    const res = await transitionAttempt({
      attemptId: "a1",
      userId: "u1",
      to: "COMPLETED",
    });
    expect(res).toEqual({ ok: false, reason: "ILLEGAL_TRANSITION" });
  });

  it("persiste failReason et failedAt sur transition FAILED", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(baseRow({ state: "VERIFYING" }));
    dbMock.missionAttempt.updateMany.mockResolvedValue({ count: 1 });
    await transitionAttempt({
      attemptId: "a1",
      userId: "u1",
      to: "FAILED",
      failReason: "mempool timeout",
    });
    const call = dbMock.missionAttempt.updateMany.mock.calls[0][0];
    expect(call.data.state).toBe("FAILED");
    expect(call.data.failedAt).toBeInstanceOf(Date);
    expect(call.data.failReason).toBe("mempool timeout");
  });

  it("transition concurrente : si count=0 renvoie ILLEGAL_TRANSITION (course perdue)", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(baseRow({ state: "PROOF_PENDING" }));
    // Un autre handler a déjà transité la row entre findFirst et updateMany.
    dbMock.missionAttempt.updateMany.mockResolvedValue({ count: 0 });
    const res = await transitionAttempt({
      attemptId: "a1",
      userId: "u1",
      to: "VERIFYING",
    });
    expect(res).toEqual({ ok: false, reason: "ILLEGAL_TRANSITION" });
  });

  it("garde optionnelle `from` : rejette si état courant hors scope", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(baseRow({ state: "IN_PROGRESS" }));
    const res = await transitionAttempt({
      attemptId: "a1",
      userId: "u1",
      to: "PROOF_PENDING",
      from: "CREATED", // mais current = IN_PROGRESS → rejet
    });
    expect(res).toEqual({ ok: false, reason: "ILLEGAL_TRANSITION" });
  });

  it("completedAt rempli sur transition COMPLETED, proofId propagé", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(baseRow({ state: "VERIFYING" }));
    dbMock.missionAttempt.updateMany.mockResolvedValue({ count: 1 });
    await transitionAttempt({
      attemptId: "a1",
      userId: "u1",
      to: "COMPLETED",
      proofId: "proof-42",
    });
    const call = dbMock.missionAttempt.updateMany.mock.calls[0][0];
    expect(call.data.completedAt).toBeInstanceOf(Date);
    expect(call.data.proofId).toBe("proof-42");
    expect(call.data.state).toBe("COMPLETED");
  });
});

describe("findLatestActiveAttempt", () => {
  it("filtre sur ACTIVE_STATES + order launchedAt desc", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(baseRow({ state: "IN_PROGRESS" }));
    const res = await findLatestActiveAttempt("u1", "tx-basics", "TX");
    expect(res?.state).toBe("IN_PROGRESS");
    const call = dbMock.missionAttempt.findFirst.mock.calls[0][0];
    expect(call.where.userId).toBe("u1");
    expect(call.where.questCode).toBe("tx-basics");
    expect(call.where.kind).toBe("TX");
    expect(call.where.state.in).toEqual(ACTIVE_STATES);
    expect(call.orderBy).toEqual({ launchedAt: "desc" });
  });

  it("kind optionnel : omet le filtre si non fourni", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(null);
    await findLatestActiveAttempt("u1", "tx-basics");
    const call = dbMock.missionAttempt.findFirst.mock.calls[0][0];
    expect(call.where.kind).toBeUndefined();
  });
});

describe("snapshotAttemptResult — LOT 4A", () => {
  it("écrit le resultJson sur la tentative COMPLETED la plus récente sans resultJson", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(
      baseRow({ state: "COMPLETED", resultJson: null }),
    );
    dbMock.missionAttempt.updateMany.mockResolvedValue({ count: 1 });
    const n = await snapshotAttemptResult({
      userId: "u1",
      questCode: "tx-basics",
      result: { xpEarned: 50, satsEarned: 100, questStatus: "COMPLETED" },
    });
    expect(n).toBe(1);
    const call = dbMock.missionAttempt.updateMany.mock.calls[0][0];
    const serialized = JSON.parse(call.data.resultJson);
    expect(serialized).toEqual({ xpEarned: 50, satsEarned: 100, questStatus: "COMPLETED" });
    expect(call.where.resultJson).toBeNull();
  });

  it("no-op silencieux si aucune tentative COMPLETED sans resultJson (pas d'attempt actif)", async () => {
    dbMock.missionAttempt.findFirst.mockResolvedValue(null);
    const n = await snapshotAttemptResult({
      userId: "u1",
      questCode: "tx-basics",
      result: { xpEarned: 50 },
    });
    expect(n).toBe(0);
    expect(dbMock.missionAttempt.updateMany).not.toHaveBeenCalled();
  });

  it("filtre strict : ne trouve pas une attempt avec resultJson déjà rempli (anti-override)", async () => {
    dbMock.missionAttempt.findFirst.mockImplementation(({ where }: { where: { resultJson?: unknown } }) => {
      // Simule le filtre Prisma `resultJson: null` — si on fournit non-null → aucun match.
      if (where.resultJson === null) return Promise.resolve(null); // déjà rempli
      return Promise.resolve(baseRow({ state: "COMPLETED" }));
    });
    const n = await snapshotAttemptResult({
      userId: "u1",
      questCode: "tx-basics",
      result: { xpEarned: 50 },
    });
    expect(n).toBe(0);
    expect(dbMock.missionAttempt.updateMany).not.toHaveBeenCalled();
  });
});

describe("expireStaleAttempts — batch idempotent", () => {
  it("retourne le count expiré", async () => {
    dbMock.missionAttempt.updateMany.mockResolvedValue({ count: 3 });
    const count = await expireStaleAttempts();
    expect(count).toBe(3);
    const call = dbMock.missionAttempt.updateMany.mock.calls[0][0];
    expect(call.data.state).toBe("EXPIRED");
    expect(call.where.state.in).toEqual(ACTIVE_STATES);
  });
});
