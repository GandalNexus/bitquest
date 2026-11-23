/**
 * Tests de la route GET /api/me/bitlab-attempts (LOT 4B — tuile
 * "Missions en cours" du dashboard BitQuest).
 *
 * Même pattern que bitlab-stats/route.test.ts : mock DB hoisté + auth
 * legacy headers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  quest: { findMany: vi.fn() },
  missionAttempt: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET as attemptsGET } from "@/app/api/me/bitlab-attempts/route";

const USER_ID = "user-l4";
const TOKEN = "token-l4";

function makeReq(query = ""): Request {
  return new Request(`http://localhost/api/me/bitlab-attempts${query}`, {
    headers: { "x-gn-user-id": USER_ID, "x-gn-token": TOKEN },
  });
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    userId: USER_ID,
    questId: "q1",
    questCode: "tx-basics",
    kind: "TX",
    network: "testnet4",
    state: "IN_PROGRESS",
    launchedAt: new Date("2026-11-11T10:00:00Z"),
    expiresAt: new Date("2026-11-11T12:00:00Z"),
    completedAt: null,
    abandonedAt: null,
    failedAt: null,
    failReason: null,
    proofId: null,
    resultJson: null,
    returnTo: "http://localhost/q/tx-basics",
    ...overrides,
  };
}

beforeEach(() => {
  dbMock.user.findUnique.mockReset();
  dbMock.quest.findMany.mockReset();
  dbMock.missionAttempt.findMany.mockReset();
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

describe("GET /api/me/bitlab-attempts", () => {
  it("401 sans authentification", async () => {
    const res = await attemptsGET(
      new Request("http://localhost/api/me/bitlab-attempts"),
    );
    expect(res.status).toBe(401);
  });

  it("retourne la liste vide si aucune tentative", async () => {
    dbMock.missionAttempt.findMany.mockResolvedValue([]);
    dbMock.quest.findMany.mockResolvedValue([]);
    const res = await attemptsGET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { attempts: unknown[] };
    expect(body.attempts).toEqual([]);
  });

  it("filtre state=active = ACTIVE_STATES", async () => {
    dbMock.missionAttempt.findMany.mockResolvedValue([]);
    dbMock.quest.findMany.mockResolvedValue([]);
    await attemptsGET(makeReq("?state=active"));
    const call = dbMock.missionAttempt.findMany.mock.calls[0][0];
    expect(call.where.state.in).toEqual([
      "CREATED",
      "IN_PROGRESS",
      "PROOF_PENDING",
      "VERIFYING",
    ]);
  });

  it("enrichit avec questTitle, fallback sur questCode si quête supprimée", async () => {
    dbMock.missionAttempt.findMany.mockResolvedValue([
      baseRow({ questCode: "tx-basics" }),
      baseRow({ id: "a2", questCode: "deleted-quest" }),
    ]);
    dbMock.quest.findMany.mockResolvedValue([
      { code: "tx-basics", title: "Anatomie d'une transaction" },
      // "deleted-quest" absente de la DB
    ]);
    const res = await attemptsGET(makeReq());
    const body = (await res.json()) as {
      attempts: Array<{ questCode: string; questTitle: string }>;
    };
    expect(body.attempts[0].questTitle).toBe("Anatomie d'une transaction");
    expect(body.attempts[1].questTitle).toBe("deleted-quest");
  });

  it("parse resultJson en objet dans la réponse", async () => {
    dbMock.missionAttempt.findMany.mockResolvedValue([
      baseRow({
        state: "COMPLETED",
        resultJson: JSON.stringify({ xpEarned: 42, satsEarned: 100 }),
      }),
    ]);
    dbMock.quest.findMany.mockResolvedValue([
      { code: "tx-basics", title: "T" },
    ]);
    const res = await attemptsGET(makeReq());
    const body = (await res.json()) as {
      attempts: Array<{ result: { xpEarned: number } | null }>;
    };
    expect(body.attempts[0].result).toEqual({ xpEarned: 42, satsEarned: 100 });
  });

  it("limit bornée à 50 max (anti-abuse)", async () => {
    dbMock.missionAttempt.findMany.mockResolvedValue([]);
    dbMock.quest.findMany.mockResolvedValue([]);
    await attemptsGET(makeReq("?limit=9999"));
    const call = dbMock.missionAttempt.findMany.mock.calls[0][0];
    expect(call.take).toBe(50);
  });

  it("scoping userId : where restreint à l'utilisateur authentifié", async () => {
    dbMock.missionAttempt.findMany.mockResolvedValue([]);
    dbMock.quest.findMany.mockResolvedValue([]);
    await attemptsGET(makeReq());
    const call = dbMock.missionAttempt.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe(USER_ID);
  });
});
