import { describe, it, expect, vi, beforeEach } from "vitest";
import { consumeBitlabProof, type BitLabProofRow } from "./consume";

const findFirstMock = vi.fn();
const updateManyMock = vi.fn();

const bitLabProof = {
  findFirst: findFirstMock,
  updateMany: updateManyMock,
};

function proof(overrides: Partial<BitLabProofRow> = {}): BitLabProofRow {
  return {
    id: "p1",
    userId: "u1",
    questCode: "tx-basics",
    kind: "TX",
    network: "testnet4",
    payload: "{}",
    verifiedAt: new Date("2026-11-11T12:00:00Z"),
    consumed: false,
    ...overrides,
  };
}

beforeEach(() => {
  findFirstMock.mockReset();
  updateManyMock.mockReset();
});

describe("consumeBitlabProof", () => {
  it("retourne NO_PROOF si aucune preuve n'existe", async () => {
    findFirstMock.mockResolvedValueOnce(null); // candidat non-consumed
    findFirstMock.mockResolvedValueOnce(null); // existing (toutes consumed)

    const res = await consumeBitlabProof(bitLabProof, "u1", "tx-basics");
    expect(res.status).toBe("NO_PROOF");
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("retourne DUPLICATE si une preuve existe mais est déjà consommée", async () => {
    findFirstMock.mockResolvedValueOnce(null); // pas de non-consumed
    findFirstMock.mockResolvedValueOnce(proof({ consumed: true }));

    const res = await consumeBitlabProof(bitLabProof, "u1", "tx-basics");
    expect(res.status).toBe("DUPLICATE");
    if (res.status === "DUPLICATE") {
      expect(res.existing.id).toBe("p1");
    }
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("consomme la preuve atomiquement quand updateMany renvoie count=1", async () => {
    findFirstMock.mockResolvedValueOnce(proof());
    updateManyMock.mockResolvedValueOnce({ count: 1 });

    const res = await consumeBitlabProof(bitLabProof, "u1", "tx-basics");
    expect(res.status).toBe("CONSUMED");
    if (res.status === "CONSUMED") {
      expect(res.proof.id).toBe("p1");
      expect(res.proof.consumed).toBe(true);
    }
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "p1", consumed: false },
      data: { consumed: true },
    });
  });

  it("retourne DUPLICATE en cas de race (updateMany count=0)", async () => {
    findFirstMock.mockResolvedValueOnce(proof());
    updateManyMock.mockResolvedValueOnce({ count: 0 });

    const res = await consumeBitlabProof(bitLabProof, "u1", "tx-basics");
    expect(res.status).toBe("DUPLICATE");
    if (res.status === "DUPLICATE") {
      expect(res.existing.id).toBe("p1");
    }
  });

  it("deux appels concurrents : un CONSUMED, un DUPLICATE (simulation)", async () => {
    // Appel A : voit la preuve, updateMany réussit (count=1).
    findFirstMock.mockResolvedValueOnce(proof());
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    // Appel B : voit la même preuve (lecture concurrente), updateMany count=0.
    findFirstMock.mockResolvedValueOnce(proof());
    updateManyMock.mockResolvedValueOnce({ count: 0 });

    const [a, b] = await Promise.all([
      consumeBitlabProof(bitLabProof, "u1", "tx-basics"),
      consumeBitlabProof(bitLabProof, "u1", "tx-basics"),
    ]);
    const outcomes = [a.status, b.status].sort();
    expect(outcomes).toEqual(["CONSUMED", "DUPLICATE"]);
  });

  it("filtre bien par (userId, questCode) dans findFirst", async () => {
    findFirstMock.mockResolvedValueOnce(proof());
    updateManyMock.mockResolvedValueOnce({ count: 1 });

    await consumeBitlabProof(bitLabProof, "u-xyz", "lightning");
    expect(findFirstMock).toHaveBeenNthCalledWith(1, {
      where: { userId: "u-xyz", questCode: "lightning", consumed: false },
      orderBy: { verifiedAt: "desc" },
    });
  });
});
