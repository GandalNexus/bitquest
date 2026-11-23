/**
 * Tests GET /api/me/attestations — LOT 26.
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
  attestation: { findMany: vi.fn() },
  quest: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET } from "./route";

const USER = { id: "user-xyz", pseudo: "learner" };

function makeReq(): Request {
  return new Request("http://localhost/api/me/attestations", { method: "GET" });
}

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.attestation.findMany.mockReset();
  dbMock.quest.findMany.mockReset();
  dbMock.quest.findMany.mockResolvedValue([]);
});

afterEach(() => vi.clearAllMocks());

describe("GET /api/me/attestations", () => {
  it("401 si non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expect(dbMock.attestation.findMany).not.toHaveBeenCalled();
  });

  it("retourne items triés par issuedAt desc", async () => {
    authenticateMock.mockResolvedValue(USER);
    const now = new Date();
    dbMock.attestation.findMany.mockResolvedValue([
      {
        id: "att-2",
        kind: "QUEST",
        targetCode: "genesis",
        metadata: JSON.stringify({ xpEarned: 150, satsEarned: 100 }),
        issuedAt: new Date(now.getTime() - 60_000),
      },
      {
        id: "att-1",
        kind: "QUEST",
        targetCode: "keys",
        metadata: JSON.stringify({ xpEarned: 200, satsEarned: 150 }),
        issuedAt: new Date(now.getTime() - 120_000),
      },
    ]);
    dbMock.quest.findMany.mockResolvedValue([
      { code: "genesis", title: "Le Bloc Genèse" },
      { code: "keys", title: "Clés et Adresses" },
    ]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { targetCode: string; targetTitle: string; metadata: Record<string, number> }[];
    };
    expect(body.items).toHaveLength(2);
    expect(body.items[0].targetCode).toBe("genesis");
    expect(body.items[0].targetTitle).toBe("Le Bloc Genèse");
    expect(body.items[0].metadata.xpEarned).toBe(150);
  });

  it("fallback targetTitle sur targetCode si quête supprimée", async () => {
    authenticateMock.mockResolvedValue(USER);
    dbMock.attestation.findMany.mockResolvedValue([
      {
        id: "att-3",
        kind: "QUEST",
        targetCode: "removed-quest",
        metadata: "{}",
        issuedAt: new Date(),
      },
    ]);
    dbMock.quest.findMany.mockResolvedValue([]); // Quest supprimée
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { targetTitle: string }[];
    };
    expect(body.items[0].targetTitle).toBe("removed-quest");
  });

  it("metadata invalide → null (robuste)", async () => {
    authenticateMock.mockResolvedValue(USER);
    dbMock.attestation.findMany.mockResolvedValue([
      {
        id: "att-4",
        kind: "QUEST",
        targetCode: "genesis",
        metadata: "not-json",
        issuedAt: new Date(),
      },
    ]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { metadata: unknown }[] };
    expect(body.items[0].metadata).toBeNull();
  });

  it("scope user strict : filtre où userId=caller", async () => {
    authenticateMock.mockResolvedValue(USER);
    dbMock.attestation.findMany.mockResolvedValue([]);
    await GET(makeReq());
    const where = dbMock.attestation.findMany.mock.calls[0]?.[0] as {
      where: { userId: string };
    };
    expect(where.where.userId).toBe("user-xyz");
  });

  it("liste vide si aucune attestation", async () => {
    authenticateMock.mockResolvedValue(USER);
    dbMock.attestation.findMany.mockResolvedValue([]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
    // Pas d'appel quest.findMany si aucun code à enrichir
    expect(dbMock.quest.findMany).not.toHaveBeenCalled();
  });
});
