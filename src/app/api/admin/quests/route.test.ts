/**
 * Tests de /api/admin/quests (POST — création quête).
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
  quest: { findUnique: vi.fn(), create: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST } from "./route";

const EDITOR = { id: "ed-1", pseudo: "ed", role: "EDITOR", token: "tk" };

const VALID = {
  code: "tx-basics",
  track: "INITIATION",
  order: 0,
  title: "Les bases TX",
  subtitle: "Comprendre les transactions",
  description: "Description longue de la quête.",
  intro: "Intro affichée en écran d'accueil.",
  xpReward: 100,
  satsReward: 50,
  requiredLevel: 1,
  missionType: "tx_builder",
  missionKind: "SIMULATED",
};

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/quests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authenticateMock.mockReset();
  dbMock.quest.findUnique.mockReset();
  dbMock.quest.create.mockReset();
  dbMock.adminAuditLog.create.mockReset();
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/quests", () => {
  it("401 non authentifié", async () => {
    authenticateMock.mockResolvedValue(null);
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(401);
  });

  it("403 APPRENTICE refusé", async () => {
    authenticateMock.mockResolvedValue({ ...EDITOR, role: "APPRENTICE" });
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(403);
  });

  it("400 Zod : code non kebab-case", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    const res = await POST(makeReq({ ...VALID, code: "Tx Basics" }));
    expect(res.status).toBe(400);
  });

  it("400 Zod : missionType inconnu", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    const res = await POST(makeReq({ ...VALID, missionType: "unicorn_dance" }));
    expect(res.status).toBe(400);
  });

  it("409 si code déjà utilisé", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.quest.findUnique.mockResolvedValue({ id: "existing", code: VALID.code });
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(409);
  });

  it("201 succès : coquille créée avec theorySections=[] + missionConfig par défaut + audit QUEST_CREATE", async () => {
    authenticateMock.mockResolvedValue(EDITOR);
    dbMock.quest.findUnique.mockResolvedValue(null);
    dbMock.quest.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "quest-1",
      ...data,
    }));
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.quest.code).toBe(VALID.code);

    const createArgs = dbMock.quest.create.mock.calls[0]?.[0] as {
      data: { theorySections: string; missionConfig: string };
    };
    expect(createArgs.data.theorySections).toBe("[]");
    expect(JSON.parse(createArgs.data.missionConfig)).toEqual({ brief: "", hint: "" });

    const auditArgs = dbMock.adminAuditLog.create.mock.calls[0]?.[0] as {
      data: { action: string };
    };
    expect(auditArgs.data.action).toBe("QUEST_CREATE");
  });
});
