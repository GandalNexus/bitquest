/**
 * Tests route publique /api/certificates/verify — LOT 29.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getRedisMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock("@/lib/cache/redis", () => ({ getRedis: () => getRedisMock() }));

import { GET } from "./route";
import { signCertificate, type CertificatePayload } from "@/lib/certificates/sign";

const PAYLOAD: CertificatePayload = {
  v: 1,
  certificateId: "cert-abc",
  attestationId: "att-xyz",
  userId: "user-123",
  kind: "QUEST",
  targetCode: "genesis",
  targetTitle: "Le Bloc Genèse",
  issuedAt: "2026-11-14T12:00:00.000Z",
  metadata: { xpEarned: 150 },
  pseudo: "satoshi",
  issuer: "bitquest.local",
};

let testIp = "";
function freshIp(): string {
  testIp = `10.9.0.${Math.floor(Math.random() * 250) + 1}-${Date.now()}`;
  return testIp;
}

function makeReq(blob: string, ip = testIp): Request {
  const qs = blob ? `?blob=${encodeURIComponent(blob)}` : "";
  return new Request(`http://localhost/api/certificates/verify${qs}`, {
    method: "GET",
    headers: { "x-forwarded-for": ip },
  });
}

let originalSecret: string | undefined;

beforeEach(() => {
  freshIp();
  originalSecret = process.env.CERT_SIGN_SECRET;
  process.env.CERT_SIGN_SECRET = "test-verify-secret-32-chars-x-yy";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CERT_SIGN_SECRET;
  else process.env.CERT_SIGN_SECRET = originalSecret;
  vi.clearAllMocks();
});

describe("GET /api/certificates/verify", () => {
  it("accepte un blob valide et retourne le payload", async () => {
    const blob = signCertificate(PAYLOAD);
    const res = await GET(makeReq(blob));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; payload: CertificatePayload };
    expect(body.ok).toBe(true);
    expect(body.payload.certificateId).toBe("cert-abc");
    expect(body.payload.kind).toBe("QUEST");
  });

  it("400 si blob manquant", async () => {
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
  });

  it("400 si blob trop court", async () => {
    const res = await GET(makeReq("abc"));
    expect(res.status).toBe(400);
  });

  it("400 si blob trop long (> 8192)", async () => {
    const res = await GET(makeReq("v1." + "x".repeat(10000)));
    expect(res.status).toBe(400);
  });

  it("400 si signature altérée", async () => {
    const blob = signCertificate(PAYLOAD);
    const parts = blob.split(".");
    parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === "a" ? "b" : "a");
    const res = await GET(makeReq(parts.join(".")));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toMatch(/signature/i);
  });

  it("400 si format invalide (pas 3 parties)", async () => {
    const res = await GET(makeReq("v1.onlytwoparts"));
    expect(res.status).toBe(400);
  });

  it("429 après 60 requêtes/60s par IP", async () => {
    const ip = freshIp();
    const blob = signCertificate(PAYLOAD);
    const results: number[] = [];
    for (let i = 0; i < 61; i++) {
      const r = await GET(makeReq(blob, ip));
      results.push(r.status);
    }
    const ok = results.filter((s) => s === 200).length;
    const throttled = results.filter((s) => s === 429).length;
    expect(ok).toBe(60);
    expect(throttled).toBeGreaterThanOrEqual(1);
  });
});
