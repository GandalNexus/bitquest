/**
 * Tests de /api/bitlab/me/attempts — endpoint CORS user-scoped pour BitLab.
 *
 * Verrouille :
 *   - OPTIONS CORS préflight.
 *   - 401 sans Bearer session token.
 *   - 401 si token audience mismatch (ex. launch_token au lieu de session).
 *   - 200 avec token valide : scope userId, enrichissement questTitle.
 *   - CORS headers présents sur toutes les réponses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  quest: { findMany: vi.fn() },
  missionAttempt: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET as attemptsGET, OPTIONS as attemptsOPTIONS } from "@/app/api/bitlab/me/attempts/route";
import { issueSessionToken, issueLaunchToken } from "@/lib/auth/launch-token";

const SECRET = "test-session-secret-at-least-32-bytes-long-ok";

beforeEach(() => {
  process.env.BITLAB_LAUNCH_SECRET = SECRET;
  dbMock.user.findUnique.mockReset();
  dbMock.quest.findMany.mockReset();
  dbMock.missionAttempt.findMany.mockReset();
  dbMock.quest.findMany.mockResolvedValue([]);
  dbMock.missionAttempt.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/bitlab/me/attempts — CORS user-scoped", () => {
  it("OPTIONS préflight renvoie 204 + CORS headers", async () => {
    const res = await attemptsOPTIONS(
      new Request("http://localhost/api/bitlab/me/attempts", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:3001" },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });

  it("401 sans Authorization header", async () => {
    const res = await attemptsGET(
      new Request("http://localhost/api/bitlab/me/attempts"),
    );
    expect(res.status).toBe(401);
    expect(res.headers.has("access-control-allow-methods")).toBe(true);
  });

  it("401 avec Authorization: Bearer bogus", async () => {
    const res = await attemptsGET(
      new Request("http://localhost/api/bitlab/me/attempts", {
        headers: { authorization: "Bearer not-a-jwt" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("401 avec un launch_token (aud mismatch — anti-confusion)", async () => {
    const { token } = await issueLaunchToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
      email: null,
      emailVerifiedAt: null,
    });
    const res = await attemptsGET(
      new Request("http://localhost/api/bitlab/me/attempts", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("200 avec session token valide + scope userId", async () => {
    const { token } = await issueSessionToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
    });
    dbMock.missionAttempt.findMany.mockResolvedValue([
      {
        id: "a1",
        userId: "u1",
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        state: "COMPLETED",
        launchedAt: new Date("2026-11-11T10:00:00Z"),
        expiresAt: new Date("2026-11-11T12:00:00Z"),
        completedAt: new Date("2026-11-11T10:15:00Z"),
        failedAt: null,
        failReason: null,
        proofId: "p1",
        resultJson: JSON.stringify({ xpEarned: 50 }),
        returnTo: "http://localhost/q/tx-basics",
      },
    ]);
    dbMock.quest.findMany.mockResolvedValue([
      { code: "tx-basics", title: "Anatomie d'une transaction" },
    ]);
    const res = await attemptsGET(
      new Request("http://localhost/api/bitlab/me/attempts", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      attempts: Array<{ questTitle: string; result: { xpEarned: number } | null }>;
    };
    expect(body.attempts).toHaveLength(1);
    expect(body.attempts[0].questTitle).toBe("Anatomie d'une transaction");
    expect(body.attempts[0].result).toEqual({ xpEarned: 50 });
    // Scope userId vérifié côté DB call.
    const call = dbMock.missionAttempt.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("u1");
  });

  it("filtre state=active = ACTIVE_STATES", async () => {
    const { token } = await issueSessionToken({
      userId: "u1",
      pseudo: "alice",
      role: "APPRENTICE",
    });
    await attemptsGET(
      new Request("http://localhost/api/bitlab/me/attempts?state=active", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    const call = dbMock.missionAttempt.findMany.mock.calls[0][0];
    expect(call.where.state.in).toEqual([
      "CREATED",
      "IN_PROGRESS",
      "PROOF_PENDING",
      "VERIFYING",
    ]);
  });
});
