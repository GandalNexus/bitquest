import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted : garantit que le mock existe avant l'évaluation du vi.mock(),
// lui-même hoisté au sommet du module par Vitest.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    bitLabProofAttempt: {
      create: createMock,
    },
  },
}));

import { recordProofAttempt } from "./audit";

beforeEach(() => {
  createMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordProofAttempt", () => {
  it("persiste une entrée ACCEPTED avec latencyMs calculé", async () => {
    createMock.mockResolvedValueOnce({ id: "x" });
    const startedAt = Date.now() - 42;
    await recordProofAttempt({
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      network: "testnet4",
      outcome: "ACCEPTED",
      startedAt,
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const data = createMock.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      network: "testnet4",
      outcome: "ACCEPTED",
      reasonMessage: null,
    });
    expect(data.latencyMs).toBeGreaterThanOrEqual(42);
    expect(data.latencyMs).toBeLessThan(2000);
  });

  it("stocke le reasonMessage quand fourni", async () => {
    createMock.mockResolvedValueOnce({ id: "x" });
    await recordProofAttempt({
      userId: "u1",
      questCode: "utxo",
      kind: "TX",
      network: "testnet4",
      outcome: "NOT_FOUND",
      reasonMessage: "tx introuvable",
      startedAt: Date.now(),
    });
    expect(createMock.mock.calls[0][0].data.reasonMessage).toBe("tx introuvable");
  });

  it("clampe latencyMs à 0 si startedAt est dans le futur", async () => {
    createMock.mockResolvedValueOnce({ id: "x" });
    await recordProofAttempt({
      userId: "u1",
      questCode: "tx-basics",
      kind: "TX",
      network: "testnet4",
      outcome: "ACCEPTED",
      startedAt: Date.now() + 10_000,
    });
    expect(createMock.mock.calls[0][0].data.latencyMs).toBe(0);
  });

  it("ne jette pas si Prisma échoue (fire-and-forget safe)", async () => {
    createMock.mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordProofAttempt({
        userId: "u1",
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        outcome: "ACCEPTED",
        startedAt: Date.now(),
      }),
    ).resolves.toBeUndefined();
  });
});
