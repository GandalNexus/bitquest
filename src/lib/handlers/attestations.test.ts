import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  attestation: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { createQuestAttestation } from "./attestations";

const PAYLOAD = {
  userId: "user-abc",
  questCode: "genesis",
  xpEarned: 150,
  satsEarned: 100,
};

beforeEach(() => {
  dbMock.attestation.create.mockReset();
});

describe("createQuestAttestation", () => {
  it("crée une Attestation kind=QUEST et renvoie son id", async () => {
    dbMock.attestation.create.mockResolvedValueOnce({ id: "att-1" });
    const id = await createQuestAttestation(PAYLOAD);
    expect(id).toBe("att-1");
    const call = dbMock.attestation.create.mock.calls[0]?.[0] as {
      data: {
        userId: string;
        kind: string;
        targetCode: string;
        metadata: string;
      };
    };
    expect(call.data.userId).toBe("user-abc");
    expect(call.data.kind).toBe("QUEST");
    expect(call.data.targetCode).toBe("genesis");
    const meta = JSON.parse(call.data.metadata) as Record<string, unknown>;
    expect(meta.xpEarned).toBe(150);
    expect(meta.satsEarned).toBe(100);
    expect(meta.questCode).toBe("genesis");
    expect(typeof meta.issuedAtEpoch).toBe("number");
  });

  it("idempotent : P2002 (unique violation) renvoie null sans throw", async () => {
    dbMock.attestation.create.mockRejectedValueOnce(
      Object.assign(new Error("unique violation"), { code: "P2002" }),
    );
    const id = await createQuestAttestation(PAYLOAD);
    expect(id).toBeNull();
  });

  it("erreur Prisma non-P2002 renvoie null sans throw (fail-closed non bloquant)", async () => {
    dbMock.attestation.create.mockRejectedValueOnce(
      Object.assign(new Error("db offline"), { code: "P1001" }),
    );
    const id = await createQuestAttestation(PAYLOAD);
    expect(id).toBeNull();
  });

  it("erreur non-Prisma (sans code) : même comportement — log + null", async () => {
    dbMock.attestation.create.mockRejectedValueOnce(new Error("boom"));
    const id = await createQuestAttestation(PAYLOAD);
    expect(id).toBeNull();
  });
});
