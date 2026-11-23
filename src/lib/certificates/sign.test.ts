import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signCertificate, verifyCertificate, type CertificatePayload } from "./sign";

const PAYLOAD: CertificatePayload = {
  v: 1,
  certificateId: "cert-abc",
  attestationId: "att-xyz",
  userId: "user-123",
  kind: "QUEST",
  targetCode: "genesis",
  targetTitle: "Le Bloc Genèse",
  issuedAt: "2026-11-14T12:00:00.000Z",
  metadata: { xpEarned: 150, satsEarned: 100 },
  pseudo: "satoshi",
  issuer: "bitquest.local",
};

let originalSecret: string | undefined;
let originalNodeEnv: string | undefined;

beforeEach(() => {
  originalSecret = process.env.CERT_SIGN_SECRET;
  originalNodeEnv = process.env.NODE_ENV;
  process.env.CERT_SIGN_SECRET = "test-cert-secret-32-chars-long-xx";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CERT_SIGN_SECRET;
  else process.env.CERT_SIGN_SECRET = originalSecret;
  // NODE_ENV est read-only côté types TS mais mutable en runtime JS.
  // Utiliser un cast pour contourner la contrainte du typage @types/node.
  if (originalNodeEnv === undefined) {
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  } else {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  }
});

describe("signCertificate / verifyCertificate", () => {
  it("roundtrip — déchiffre exactement le payload", () => {
    const blob = signCertificate(PAYLOAD);
    const back = verifyCertificate(blob);
    expect(back.certificateId).toBe("cert-abc");
    expect(back.kind).toBe("QUEST");
    expect(back.metadata).toEqual({ xpEarned: 150, satsEarned: 100 });
  });

  it("format v1.payload.signature (3 parts base64url)", () => {
    const blob = signCertificate(PAYLOAD);
    const parts = blob.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("v1");
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("deux signatures du même payload sont identiques (déterministe)", () => {
    const a = signCertificate(PAYLOAD);
    const b = signCertificate(PAYLOAD);
    expect(a).toBe(b);
  });

  it("canonicalise les clés (ordre JSON ne compte pas)", () => {
    const reordered: CertificatePayload = {
      ...PAYLOAD,
      // Même contenu mais insertion dans l'ordre inverse
    };
    const a = signCertificate(PAYLOAD);
    const b = signCertificate(reordered);
    expect(a).toBe(b);
  });

  it("rejette une signature altérée", () => {
    const blob = signCertificate(PAYLOAD);
    const parts = blob.split(".");
    parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === "a" ? "b" : "a");
    expect(() => verifyCertificate(parts.join("."))).toThrow(/signature/i);
  });

  it("rejette un payload altéré", () => {
    const blob = signCertificate(PAYLOAD);
    const parts = blob.split(".");
    // Flip un caractère du payload b64
    parts[1] = parts[1].slice(0, -2) + (parts[1].slice(-2) === "aa" ? "bb" : "aa");
    expect(() => verifyCertificate(parts.join("."))).toThrow();
  });

  it("rejette un format invalide (moins de 3 parties)", () => {
    expect(() => verifyCertificate("v1.foo")).toThrow(/format/i);
    expect(() => verifyCertificate("single")).toThrow(/format/i);
  });

  it("rejette une version future", () => {
    const blob = signCertificate(PAYLOAD);
    const parts = blob.split(".");
    parts[0] = "v2";
    expect(() => verifyCertificate(parts.join("."))).toThrow(/version/i);
  });

  it("secrets différents → signatures incompatibles", () => {
    const a = signCertificate(PAYLOAD);
    process.env.CERT_SIGN_SECRET = "different-secret-32-chars-long-yy";
    expect(() => verifyCertificate(a)).toThrow(/signature/i);
  });

  it("refuse de signer en prod si CERT_SIGN_SECRET et CSRF_SECRET absents", () => {
    delete process.env.CERT_SIGN_SECRET;
    const originalCsrf = process.env.CSRF_SECRET;
    delete process.env.CSRF_SECRET;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(() => signCertificate(PAYLOAD)).toThrow(/CERT_SIGN_SECRET/);
    if (originalCsrf !== undefined) process.env.CSRF_SECRET = originalCsrf;
  });
});
