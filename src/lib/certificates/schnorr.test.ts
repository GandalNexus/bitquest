import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getInstancePublicKeyHex,
  hasInstanceSchnorrKey,
  signCertificateSchnorr,
  verifyCertificateSchnorr,
  verifyCertificateSchnorrWithPubkey,
} from "./schnorr";

const TEST_PRIV =
  "a".repeat(63) + "1"; // 64 hex chars, arbitraire mais valide

let originalPriv: string | undefined;

beforeEach(() => {
  originalPriv = process.env.CERT_SIGN_PRIVKEY_HEX;
  process.env.CERT_SIGN_PRIVKEY_HEX = TEST_PRIV;
});

afterEach(() => {
  if (originalPriv === undefined) delete process.env.CERT_SIGN_PRIVKEY_HEX;
  else process.env.CERT_SIGN_PRIVKEY_HEX = originalPriv;
});

describe("schnorr certificate v2", () => {
  it("roundtrip sign/verify sur un payload simple", async () => {
    const payload = { v: 2, kind: "QUEST", targetCode: "genesis" };
    const blob = await signCertificateSchnorr(payload);
    expect(blob).toMatch(/^v2\.[A-Za-z0-9_-]+\.[0-9a-f]{128}$/);
    const back = await verifyCertificateSchnorr(blob);
    expect(back).toEqual(payload);
  });

  it("format v2.payload.sig (3 parts, sig = 128 hex)", async () => {
    const blob = await signCertificateSchnorr({ a: 1 });
    const parts = blob.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("v2");
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[2]).toMatch(/^[0-9a-f]{128}$/);
  });

  it("canonicalise les clés (payload b64 identique quel que soit l'ordre)", async () => {
    const a = await signCertificateSchnorr({ a: 1, b: 2, c: 3 });
    const b = await signCertificateSchnorr({ c: 3, b: 2, a: 1 });
    // Le payload b64 (segment 1) doit être identique ; la signature
    // Schnorr @noble v3 utilise un nonce randomisé par défaut, donc
    // les sigs diffèrent mais les deux vérifient.
    expect(a.split(".")[1]).toBe(b.split(".")[1]);
    const backA = await verifyCertificateSchnorr(a);
    const backB = await verifyCertificateSchnorr(b);
    expect(backA).toEqual(backB);
  });

  it("deux signatures du même payload vérifient toutes les deux", async () => {
    const a = await signCertificateSchnorr({ a: 1 });
    const b = await signCertificateSchnorr({ a: 1 });
    // Schnorr BIP-340 : nonce `aux_rand` randomisé par défaut chez
    // @noble v3 → signatures distinctes mais toutes deux valides.
    await expect(verifyCertificateSchnorr(a)).resolves.toEqual({ a: 1 });
    await expect(verifyCertificateSchnorr(b)).resolves.toEqual({ a: 1 });
  });

  it("rejette une signature altérée", async () => {
    const blob = await signCertificateSchnorr({ a: 1 });
    const parts = blob.split(".");
    // Flip du dernier nibble de la sig (reste valide hex)
    parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === "0" ? "1" : "0");
    await expect(verifyCertificateSchnorr(parts.join("."))).rejects.toThrow(
      /signature/i,
    );
  });

  it("rejette un payload altéré", async () => {
    const blob = await signCertificateSchnorr({ a: 1 });
    const parts = blob.split(".");
    // Change le payload b64 → signature ne matchera plus
    parts[1] =
      parts[1].slice(0, -2) + (parts[1].slice(-2) === "AA" ? "BB" : "AA");
    await expect(verifyCertificateSchnorr(parts.join("."))).rejects.toThrow();
  });

  it("rejette un format invalide (moins de 3 parties)", async () => {
    await expect(verifyCertificateSchnorr("v2.foo")).rejects.toThrow(/format/i);
  });

  it("rejette une version non-v2", async () => {
    await expect(verifyCertificateSchnorr("v1.foo.deadbeef")).rejects.toThrow(
      /version/i,
    );
  });

  it("rejette une signature hex malformée (!= 128 chars)", async () => {
    await expect(
      verifyCertificateSchnorr("v2.aGVsbG8.abc123"),
    ).rejects.toThrow(/malformée/i);
  });

  it("verifyCertificateSchnorrWithPubkey accepte la pubkey de l'instance", async () => {
    const blob = await signCertificateSchnorr({ a: 1 });
    const pub = getInstancePublicKeyHex();
    const back = await verifyCertificateSchnorrWithPubkey(blob, pub);
    expect(back).toEqual({ a: 1 });
  });

  it("verifyCertificateSchnorrWithPubkey rejette une autre pubkey", async () => {
    const blob = await signCertificateSchnorr({ a: 1 });
    const otherPub = "b".repeat(64);
    await expect(
      verifyCertificateSchnorrWithPubkey(blob, otherPub),
    ).rejects.toThrow(/invalide/i);
  });

  it("hasInstanceSchnorrKey = true quand env est set", () => {
    expect(hasInstanceSchnorrKey()).toBe(true);
    delete process.env.CERT_SIGN_PRIVKEY_HEX;
    expect(hasInstanceSchnorrKey()).toBe(false);
  });

  it("getInstancePublicKeyHex est stable pour une même clé", () => {
    const pub1 = getInstancePublicKeyHex();
    const pub2 = getInstancePublicKeyHex();
    expect(pub1).toBe(pub2);
    expect(pub1).toMatch(/^[0-9a-f]{64}$/);
  });
});
