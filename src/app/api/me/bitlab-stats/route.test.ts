/**
 * Tests de la route GET /api/me/bitlab-stats (I4 — tuile "Missions
 * pratiques" du dashboard BitQuest).
 *
 * Même pattern que src/app/api/bitlab/flow.e2e.test.ts :
 *   - Mock DB hoisté
 *   - Auth via headers legacy x-gn-user-id / x-gn-token
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  quest: { findUnique: vi.fn() },
  bitLabProof: { count: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET as bitlabStatsGET } from "@/app/api/me/bitlab-stats/route";

const USER_ID = "user-i4";
const TOKEN = "token-i4";

function makeReq(): Request {
  return new Request("http://localhost/api/me/bitlab-stats", {
    headers: {
      "x-gn-user-id": USER_ID,
      "x-gn-token": TOKEN,
    },
  });
}

beforeEach(() => {
  dbMock.user.findUnique.mockReset();
  dbMock.quest.findUnique.mockReset();
  dbMock.bitLabProof.count.mockReset();
  dbMock.bitLabProof.findFirst.mockReset();
  dbMock.user.findUnique.mockImplementation(
    ({ where }: { where: { id?: string; token?: string } }) => {
      if (where.id === USER_ID || where.token === TOKEN) {
        return Promise.resolve({ id: USER_ID, token: TOKEN, deletedAt: null });
      }
      return Promise.resolve(null);
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/me/bitlab-stats", () => {
  it("401 si l'utilisateur n'est pas authentifié", async () => {
    const res = await bitlabStatsGET(
      new Request("http://localhost/api/me/bitlab-stats"),
    );
    expect(res.status).toBe(401);
  });

  it("retourne count=0 et lastProof=null quand l'user n'a aucune preuve", async () => {
    dbMock.bitLabProof.count
      .mockResolvedValueOnce(0) // total
      .mockResolvedValueOnce(0); // consumed
    dbMock.bitLabProof.findFirst.mockResolvedValueOnce(null);

    const res = await bitlabStatsGET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      proofCount: 0,
      consumedCount: 0,
      lastProof: null,
    });
    // Pas besoin de lookup quest quand pas de preuve
    expect(dbMock.quest.findUnique).not.toHaveBeenCalled();
  });

  it("enrichit lastProof avec le titre de la quête", async () => {
    dbMock.bitLabProof.count
      .mockResolvedValueOnce(5) // total
      .mockResolvedValueOnce(3); // consumed
    dbMock.bitLabProof.findFirst.mockResolvedValueOnce({
      questCode: "tx-basics",
      kind: "TX",
      network: "testnet4",
      verifiedAt: new Date("2026-11-11T10:00:00.000Z"),
      consumed: true,
    });
    dbMock.quest.findUnique.mockResolvedValueOnce({
      title: "Anatomie d'une transaction",
    });

    const res = await bitlabStatsGET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      proofCount: 5,
      consumedCount: 3,
      lastProof: {
        questCode: "tx-basics",
        questTitle: "Anatomie d'une transaction",
        kind: "TX",
        network: "testnet4",
        verifiedAt: "2026-11-11T10:00:00.000Z",
        consumed: true,
      },
    });
  });

  it("fallback sur questCode comme titre si la quête a été supprimée", async () => {
    dbMock.bitLabProof.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    dbMock.bitLabProof.findFirst.mockResolvedValueOnce({
      questCode: "deleted-quest",
      kind: "INVOICE",
      network: "signet",
      verifiedAt: new Date("2026-11-10T08:00:00.000Z"),
      consumed: false,
    });
    dbMock.quest.findUnique.mockResolvedValueOnce(null);

    const res = await bitlabStatsGET(makeReq());
    const body = await res.json();
    expect(body.lastProof.questTitle).toBe("deleted-quest");
    expect(body.proofCount).toBe(1);
    expect(body.consumedCount).toBe(0);
  });

  it("filtre les preuves par userId (count scopé)", async () => {
    dbMock.bitLabProof.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    dbMock.bitLabProof.findFirst.mockResolvedValueOnce(null);

    await bitlabStatsGET(makeReq());

    // Les 2 count + 1 findFirst doivent tous filtrer sur userId
    expect(dbMock.bitLabProof.count).toHaveBeenNthCalledWith(1, {
      where: { userId: USER_ID },
    });
    expect(dbMock.bitLabProof.count).toHaveBeenNthCalledWith(2, {
      where: { userId: USER_ID, consumed: true },
    });
    expect(dbMock.bitLabProof.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { verifiedAt: "desc" },
      select: expect.objectContaining({
        questCode: true,
        kind: true,
        network: true,
        verifiedAt: true,
        consumed: true,
      }),
    });
  });
});
