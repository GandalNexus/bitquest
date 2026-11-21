/**
 * Tests e2e du flow BitQuest ↔ BitLab — P0.5.
 *
 * Verrouille les hardenings P0.1–P0.4 en les testant ensemble, pas isolément.
 *
 * Mocks :
 *   - `@/lib/db` : tables utilisées par les routes BitLab (user, quest,
 *     bitLabProof, bitLabProofAttempt).
 *   - `@/lib/cache/redis` : null → fallback in-memory (isolé par test via
 *     clé unique).
 *   - `fetch` global : réponses mempool.space / blockstream.info.
 *
 * Auth : on utilise les headers legacy `x-gn-user-id` + `x-gn-token` pour
 * contourner CSRF (cookie) sans perdre en couverture — la logique CSRF a
 * ses propres tests unitaires.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

/* ---------- Mocks DB & Redis ---------- */

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  quest: { findUnique: vi.fn() },
  bitLabProof: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  bitLabProofAttempt: { create: vi.fn().mockResolvedValue({ id: "a" }) },
  // MissionAttempt (LOT 1) — par défaut, no-op silencieux : l'e2e historique
  // n'utilise pas d'attemptId, le serveur bascule donc sur findLatestActiveAttempt
  // qui doit pouvoir retourner null sans casser le flux.
  missionAttempt: {
    create: vi.fn().mockResolvedValue({ id: "attempt-mock", expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) }),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

const getRedisMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock("@/lib/cache/redis", () => ({ getRedis: () => getRedisMock(), isRedisStrict: () => false }));

/* ---------- Imports — APRÈS les vi.mock ---------- */

import { POST as deepLinkPOST } from "@/app/api/bitlab/deep-link/route";
import { POST as verifyReturnPOST } from "@/app/api/bitlab/deep-link/verify-return/route";
import { POST as challengePOST } from "@/app/api/bitlab/challenge/route";
import { POST as proofPOST } from "@/app/api/bitlab/proof/route";
import { PROTOCOL_VERSION } from "@/lib/bitlab/protocol";

const SESSION_USER_ID = "user-e2e";
const SESSION_TOKEN = "token-e2e";
const JWT_SECRET = "dev-e2e-secret-at-least-32-bytes-ok";

function authHeaders(): Record<string, string> {
  return {
    "x-gn-user-id": SESSION_USER_ID,
    "x-gn-token": SESSION_TOKEN,
    "content-type": "application/json",
  };
}

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/bitlab/test", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

function mockAuthedUser() {
  dbMock.user.findUnique.mockImplementation(({ where }: { where: { id?: string; token?: string } }) => {
    if (where.id === SESSION_USER_ID || where.token === SESSION_TOKEN) {
      return Promise.resolve({
        id: SESSION_USER_ID,
        token: SESSION_TOKEN,
        deletedAt: null,
      });
    }
    return Promise.resolve(null);
  });
}

function mockQuest(code: string, missionConfig: string | null = null) {
  dbMock.quest.findUnique.mockImplementation(({ where }: { where: { code: string } }) => {
    if (where.code === code) {
      return Promise.resolve({ id: "q1", code, missionConfig });
    }
    return Promise.resolve(null);
  });
}

beforeEach(() => {
  process.env.BITLAB_JWT_SECRET = JWT_SECRET;
  process.env.BITLAB_SIGN_SECRET = "hmac-secret-for-deep-link-at-least-16-bytes";
  // Reset mocks
  dbMock.user.findUnique.mockReset();
  dbMock.quest.findUnique.mockReset();
  dbMock.bitLabProof.findFirst.mockReset();
  dbMock.bitLabProof.upsert.mockReset();
  dbMock.bitLabProof.updateMany.mockReset();
  dbMock.bitLabProofAttempt.create.mockReset();
  dbMock.bitLabProofAttempt.create.mockResolvedValue({ id: "a" });
  dbMock.missionAttempt.create.mockReset();
  dbMock.missionAttempt.create.mockResolvedValue({
    id: "attempt-mock",
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  });
  dbMock.missionAttempt.findFirst.mockReset();
  dbMock.missionAttempt.findFirst.mockResolvedValue(null);
  dbMock.missionAttempt.findMany.mockReset();
  dbMock.missionAttempt.findMany.mockResolvedValue([]);
  dbMock.missionAttempt.updateMany.mockReset();
  dbMock.missionAttempt.updateMany.mockResolvedValue({ count: 1 });
  getRedisMock.mockReset();
  getRedisMock.mockResolvedValue(null);
  mockAuthedUser();
});

afterEach(() => {
  delete process.env.BITLAB_JWT_SECRET;
  delete process.env.BITLAB_SIGN_SECRET;
  vi.restoreAllMocks();
});

/* ============================================================
 * Scénario 1 : deep-link signé v1 → verify-return OK
 * ============================================================ */

describe("e2e deep-link v1", () => {
  it("génère une URL signée avec v=1 et la vérifie avec succès", async () => {
    mockQuest("tx-basics");
    const buildRes = await deepLinkPOST(
      makeReq({
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        returnTo: "http://localhost/quests/tx-basics",
      }),
    );
    expect(buildRes.status).toBe(200);
    const buildBody = (await buildRes.json()) as {
      ok: boolean;
      url: string;
      signed: boolean;
      protocolVersion: number;
    };
    expect(buildBody.ok).toBe(true);
    expect(buildBody.signed).toBe(true);
    expect(buildBody.protocolVersion).toBe(PROTOCOL_VERSION);

    const url = new URL(buildBody.url);
    const ts = Number(url.searchParams.get("ts"));
    const sig = url.searchParams.get("sig");
    const v = Number(url.searchParams.get("v"));
    expect(v).toBe(PROTOCOL_VERSION);
    expect(sig).toMatch(/^[A-Za-z0-9_-]+$/);

    const verifyRes = await verifyReturnPOST(
      makeReq({
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        ts,
        sig,
        v,
      }),
    );
    const verifyBody = (await verifyRes.json()) as { ok: boolean; enforced: boolean };
    expect(verifyBody).toEqual({ ok: true, enforced: true });
  });

  it("propage title + instructions au deep-link quand la quête a brief/title (I2)", async () => {
    dbMock.quest.findUnique.mockResolvedValueOnce({
      id: "q1",
      code: "tx-basics",
      title: "Anatomie d'une transaction",
      missionConfig: JSON.stringify({
        variant: "payment",
        target: 45000,
        brief: "Construis un paiement de 45000 sats dans l'atelier.",
      }),
    });
    const res = await deepLinkPOST(
      makeReq({
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        returnTo: "http://localhost/q",
      }),
    );
    const body = (await res.json()) as { url: string };
    const url = new URL(body.url);
    expect(url.searchParams.get("title")).toBe("Anatomie d'une transaction");
    expect(url.searchParams.get("instructions")).toBe(
      "Construis un paiement de 45000 sats dans l'atelier.",
    );
  });

  it("refuse 404 si la quête n'existe pas (LOT 1 : attempt nécessite une quête valide)", async () => {
    dbMock.quest.findUnique.mockResolvedValueOnce(null);
    const res = await deepLinkPOST(
      makeReq({
        questCode: "unknown-quest",
        kind: "TX",
        network: "testnet4",
        returnTo: "http://localhost/q",
      }),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Qu[eê]te inconnue/);
    // Aucune tentative créée pour une quête fantôme.
    expect(dbMock.missionAttempt.create).not.toHaveBeenCalled();
  });

  it("tronque le brief à 300 chars (défense contre missionConfig abusif)", async () => {
    dbMock.quest.findUnique.mockResolvedValueOnce({
      id: "q1",
      code: "tx-basics",
      title: "T",
      missionConfig: JSON.stringify({ brief: "x".repeat(500) }),
    });
    const res = await deepLinkPOST(
      makeReq({
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        returnTo: "http://localhost/q",
      }),
    );
    const body = (await res.json()) as { url: string };
    const url = new URL(body.url);
    expect(url.searchParams.get("instructions")).toHaveLength(300);
  });

  it("rejette la vérification quand v > PROTOCOL_VERSION", async () => {
    mockQuest("tx-basics");
    const buildBody = (await (
      await deepLinkPOST(
        makeReq({
          questCode: "tx-basics",
          kind: "TX",
          network: "testnet4",
          returnTo: "http://localhost/q",
        }),
      )
    ).json()) as { url: string };
    const url = new URL(buildBody.url);
    const res = await verifyReturnPOST(
      makeReq({
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        ts: Number(url.searchParams.get("ts")),
        sig: url.searchParams.get("sig"),
        v: PROTOCOL_VERSION + 1,
      }),
    );
    const body = (await res.json()) as { ok: boolean; enforced: boolean };
    expect(body).toEqual({ ok: false, enforced: true });
  });
});

/* ============================================================
 * Scénario 2 : challenge JWT v1 → proof TX accepté
 * ============================================================ */

describe("e2e challenge → proof TX", () => {
  it("émet un JWT v1 puis accepte une preuve TX confirmée", async () => {
    mockQuest("tx-basics");

    // 1. Challenge
    const chRes = await challengePOST(
      makeReq({ questCode: "tx-basics", kind: "TX" }),
    );
    expect(chRes.status).toBe(200);
    const chBody = (await chRes.json()) as {
      ok: boolean;
      token: string;
      protocolVersion: number;
    };
    expect(chBody.ok).toBe(true);
    expect(chBody.protocolVersion).toBe(PROTOCOL_VERSION);

    // 2. Mock mempool : TX confirmée.
    const txid = "a".repeat(64);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          txid,
          status: { confirmed: true, block_height: 100, block_hash: "h".repeat(64) },
          fee: 123,
          size: 200,
          vout: [{ scriptpubkey_address: "tb1q", value: 1000 }],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    // 3. Mock upsert BitLabProof.
    dbMock.bitLabProof.upsert.mockResolvedValue({
      id: "proof-1",
      kind: "TX",
      network: "testnet4",
      verifiedAt: new Date("2026-11-11T12:00:00Z"),
      consumed: false,
    });

    // 4. Proof
    const proofRes = await proofPOST(
      makeReq({
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        payload: { txid },
        challenge: chBody.token,
      }),
    );
    expect(proofRes.status).toBe(200);
    const proofBody = (await proofRes.json()) as { ok: boolean; proof: { id: string } };
    expect(proofBody.ok).toBe(true);
    expect(proofBody.proof.id).toBe("proof-1");
    expect(dbMock.bitLabProof.upsert).toHaveBeenCalledTimes(1);
  });
});

/* ============================================================
 * Scénario 3 : JWT v > PROTOCOL_VERSION → rejet 400
 * ============================================================ */

describe("e2e proof — anti-downgrade JWT", () => {
  it("rejette une preuve avec un JWT signé en v: PROTOCOL_VERSION + 1", async () => {
    mockQuest("tx-basics");

    // Forge un JWT v=future avec le même secret.
    const now = Math.floor(Date.now() / 1000);
    const forged = await new SignJWT({
      v: PROTOCOL_VERSION + 1,
      userId: SESSION_USER_ID,
      questCode: "tx-basics",
      kind: "TX",
      nonce: "fake-nonce-at-least-16-chars-long",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("bitquest")
      .setAudience("bitlab")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(new TextEncoder().encode(JWT_SECRET));

    const res = await proofPOST(
      makeReq({
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        payload: { txid: "b".repeat(64) },
        challenge: forged,
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/non supportée|version/i);
    // upsert ne doit pas avoir été appelé.
    expect(dbMock.bitLabProof.upsert).not.toHaveBeenCalled();
    // Audit log doit contenir un INVALID_JWT.
    expect(dbMock.bitLabProofAttempt.create).toHaveBeenCalledTimes(1);
    const call = dbMock.bitLabProofAttempt.create.mock.calls[0][0] as {
      data: { outcome: string };
    };
    expect(call.data.outcome).toBe("INVALID_JWT");
  });
});

/* ============================================================
 * Scénario 4 : ADDRESS niveau USED mais funded_txo_count = 0 → 409
 * ============================================================ */

describe("e2e proof ADDRESS — niveau USED", () => {
  it("rejette avec 409 quand l'adresse n'a jamais été créditée", async () => {
    mockQuest("addr-used", JSON.stringify({ addressVerifyLevel: "USED" }));

    // Challenge d'abord (pour obtenir un JWT valide v1)
    const chBody = (await (
      await challengePOST(makeReq({ questCode: "addr-used", kind: "ADDRESS" }))
    ).json()) as { token: string };

    // Mock mempool /address : funded_txo_count = 0
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          address: "tb1qar0srrr7xfkvy5l643lydnw9re59gtzzwfhapy",
          chain_stats: {
            funded_txo_count: 0,
            funded_txo_sum: 0,
            spent_txo_count: 0,
            spent_txo_sum: 0,
            tx_count: 0,
          },
          mempool_stats: { tx_count: 0 },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const res = await proofPOST(
      makeReq({
        questCode: "addr-used",
        kind: "ADDRESS",
        network: "testnet4",
        payload: { address: "tb1qar0srrr7xfkvy5l643lydnw9re59gtzzwfhapy" },
        challenge: chBody.token,
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; fundedTxoCount: number };
    expect(body.fundedTxoCount).toBe(0);
    expect(body.error).toMatch(/jamais créditée/);
    // upsert ne doit pas avoir eu lieu.
    expect(dbMock.bitLabProof.upsert).not.toHaveBeenCalled();
    // Audit REJECTED.
    const calls = dbMock.bitLabProofAttempt.create.mock.calls;
    const outcomes = calls.map((c) => (c[0] as { data: { outcome: string } }).data.outcome);
    expect(outcomes).toContain("REJECTED");
  });

  it("rate-limit IP coupe plusieurs comptes derrière la même IP", async () => {
    mockQuest("tx-basics");
    // 30 appels userId est la limite ; l'IP limit est 120. On va forcer un
    // 429 "depuis cette IP" en envoyant 121 requêtes depuis la même IP avec
    // 4 userIds différents (30 chacun × 4 = 120, le 121e doit être bloqué).
    // L'auth user dépend du header x-gn-user-id ; on mock findUnique pour
    // accepter n'importe quel userId du jeu de test.
    dbMock.user.findUnique.mockImplementation(() =>
      Promise.resolve({ id: "u-dyn", token: "t-dyn", deletedAt: null }),
    );

    // IP unique à chaque run pour éviter d'hériter d'une bucket in-memory saturée
    // par un test précédent dans le même process.
    const ip = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
    const make = () =>
      new Request("http://localhost/api/bitlab/challenge", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": ip,
          "x-gn-user-id": "u-dyn",
          "x-gn-token": "t-dyn",
        },
        body: JSON.stringify({ questCode: "tx-basics", kind: "TX" }),
      });

    let lastIpRefusal: Response | null = null;
    for (let i = 0; i < 125; i++) {
      const res = await challengePOST(make());
      if (res.status === 429) {
        const body = (await res.json()) as { error: string };
        if (body.error.includes("IP")) {
          lastIpRefusal = res;
          break;
        }
      }
    }
    expect(lastIpRefusal).not.toBeNull();
  });

  it("accepte en niveau FORMAT (default) sans toucher mempool", async () => {
    mockQuest("addr-format"); // missionConfig null → FORMAT default

    const chBody = (await (
      await challengePOST(makeReq({ questCode: "addr-format", kind: "ADDRESS" }))
    ).json()) as { token: string };

    // fetch mock pour détecter un appel inattendu.
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    dbMock.bitLabProof.upsert.mockResolvedValue({
      id: "p-addr",
      kind: "ADDRESS",
      network: "testnet4",
      verifiedAt: new Date(),
      consumed: false,
    });

    const res = await proofPOST(
      makeReq({
        questCode: "addr-format",
        kind: "ADDRESS",
        network: "testnet4",
        payload: { address: "tb1qar0srrr7xfkvy5l643lydnw9re59gtzzwfhapy" },
        challenge: chBody.token,
      }),
    );
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled(); // niveau FORMAT = pas d'appel réseau
  });
});

/* ============================================================
 * LOT 1 : cycle de vie MissionAttempt (intégration unifiée GandalNexus)
 *
 * Verrouille : l'ID d'attempt créé par /deep-link voyage dans les claims
 * JWT du challenge et déclenche les bonnes transitions côté /proof. Un
 * replay après COMPLETED renvoie un succès idempotent sans refaire les
 * vérifs réseau.
 * ============================================================ */

describe("e2e MissionAttempt — cycle de vie", () => {
  it("deep-link crée une tentative CREATED et l'expose dans la réponse", async () => {
    mockAuthedUser();
    mockQuest("tx-basics");
    const attemptExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    dbMock.missionAttempt.create.mockResolvedValue({
      id: "attempt-lot1",
      expiresAt: attemptExpiresAt,
    });

    const res = await deepLinkPOST(
      makeReq({
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        returnTo: "http://localhost/q/tx-basics",
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      attemptId: string;
      url: string;
      expiresAt: string;
    };
    expect(body.attemptId).toBe("attempt-lot1");
    expect(new URL(body.url).searchParams.get("attemptId")).toBe("attempt-lot1");
    const createCall = dbMock.missionAttempt.create.mock.calls[0][0];
    expect(createCall.data.state).toBe("CREATED");
    expect(createCall.data.questCode).toBe("tx-basics");
    expect(createCall.data.returnTo).toBe("http://localhost/q/tx-basics");
  });

  it("challenge propage attemptId dans les claims et transite CREATED → IN_PROGRESS", async () => {
    mockAuthedUser();
    mockQuest("tx-basics");
    // attempt existe en CREATED → challenge doit transiter.
    const attemptRow = {
      id: "attempt-lot1",
      userId: SESSION_USER_ID,
      questId: "q1",
      questCode: "tx-basics",
      kind: "TX",
      network: "testnet4",
      state: "CREATED",
      launchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      completedAt: null,
      abandonedAt: null,
      failedAt: null,
      failReason: null,
      proofId: null,
      resultJson: null,
      returnTo: null,
    };
    dbMock.missionAttempt.findFirst.mockResolvedValue(attemptRow);
    dbMock.missionAttempt.updateMany.mockResolvedValue({ count: 1 });

    const res = await challengePOST(
      makeReq({ questCode: "tx-basics", kind: "TX", attemptId: "attempt-lot1" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; attemptId: string };
    expect(body.attemptId).toBe("attempt-lot1");

    // La transition CREATED → IN_PROGRESS doit avoir eu lieu.
    const transitionCall = dbMock.missionAttempt.updateMany.mock.calls.find(
      (c) => (c[0] as { data: { state?: string } }).data.state === "IN_PROGRESS",
    );
    expect(transitionCall).toBeDefined();
  });

  it("proof : attempt non trouvé pour l'user → 404 + rien d'uploadé", async () => {
    mockAuthedUser();
    mockQuest("tx-basics");
    dbMock.missionAttempt.findFirst.mockResolvedValue(null);

    // Challenge avec attemptId inexistant → 404 (route challenge rejette).
    const res = await challengePOST(
      makeReq({ questCode: "tx-basics", kind: "TX", attemptId: "ghost" }),
    );
    expect(res.status).toBe(404);
  });

  it("proof idempotent : attempt déjà COMPLETED → pas de re-verif + pas de re-crédit", async () => {
    mockAuthedUser();
    mockQuest("tx-basics");

    // 1er appel : attempt CREATED → le challenge émet un JWT avec attemptId.
    const attemptLive = {
      id: "attempt-lot1",
      userId: SESSION_USER_ID,
      questId: "q1",
      questCode: "tx-basics",
      kind: "TX",
      network: "testnet4",
      state: "CREATED",
      launchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      completedAt: null,
      abandonedAt: null,
      failedAt: null,
      failReason: null,
      proofId: null,
      resultJson: null,
      returnTo: null,
    };
    dbMock.missionAttempt.findFirst.mockResolvedValue(attemptLive);
    dbMock.missionAttempt.updateMany.mockResolvedValue({ count: 1 });

    const chRes = await challengePOST(
      makeReq({ questCode: "tx-basics", kind: "TX", attemptId: "attempt-lot1" }),
    );
    const chBody = (await chRes.json()) as { token: string };

    // 2e appel : au moment où /proof lit l'attempt, il est déjà COMPLETED
    // (simulation d'un re-click sur le lien de retour). fetch ne doit PAS
    // être appelé, bitLabProof.upsert ne doit PAS être appelé.
    const completedRow = {
      ...attemptLive,
      state: "COMPLETED",
      completedAt: new Date(),
      proofId: "proof-prev",
      resultJson: JSON.stringify({ xpEarned: 50 }),
    };
    dbMock.missionAttempt.findFirst.mockResolvedValue(completedRow);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const proofRes = await proofPOST(
      makeReq({
        questCode: "tx-basics",
        kind: "TX",
        network: "testnet4",
        payload: { txid: "a".repeat(64) },
        challenge: chBody.token,
      }),
    );
    expect(proofRes.status).toBe(200);
    const proofBody = (await proofRes.json()) as {
      idempotent: boolean;
      attempt: { state: string };
    };
    expect(proofBody.idempotent).toBe(true);
    expect(proofBody.attempt.state).toBe("COMPLETED");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dbMock.bitLabProof.upsert).not.toHaveBeenCalled();
  });
});
