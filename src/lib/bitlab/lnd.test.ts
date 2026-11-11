import { describe, it, expect, afterEach } from "vitest";
import {
  getLndConfig,
  isChanId,
  mapLndChannel,
  scidToChanId,
} from "./lnd";

const ENV_KEYS = ["LND_REST_URL", "LND_MACAROON_HEX", "LND_TLS_INSECURE"] as const;
const savedEnv: Record<string, string | undefined> = {};

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
    delete savedEnv[k];
  }
});

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("scidToChanId", () => {
  it("encode 0x0x1 → 1", () => {
    expect(scidToChanId("0x0x1")).toBe("1");
  });

  it("encode 1x0x0 → 2^40 = 1099511627776", () => {
    expect(scidToChanId("1x0x0")).toBe("1099511627776");
  });

  it("encode 859100x1234x0 selon BOLT 07", () => {
    // Vecteur calculé via la formule (block << 40) | (tx << 16) | vout.
    // On vérifie aussi que vout=0 implique 16 bits de poids faible à 0.
    const out = scidToChanId("859100x1234x0");
    expect(BigInt(out) & BigInt(0xffff)).toBe(BigInt(0));
    const expected = (
      (BigInt(859100) << BigInt(40)) |
      (BigInt(1234) << BigInt(16))
    ).toString();
    expect(out).toBe(expected);
  });

  it("supporte les espaces latéraux", () => {
    const expected = (
      (BigInt(1) << BigInt(40)) |
      (BigInt(2) << BigInt(16)) |
      BigInt(3)
    ).toString();
    expect(scidToChanId("  1x2x3  ")).toBe(expected);
  });

  it("jette sur mauvais nombre de composantes", () => {
    expect(() => scidToChanId("1x2")).toThrow(/3 composantes/);
    expect(() => scidToChanId("1x2x3x4")).toThrow(/3 composantes/);
  });

  it("jette sur composantes non numériques", () => {
    expect(() => scidToChanId("abcx1x0")).toThrow(/non numériques/);
    expect(() => scidToChanId("-1x0x0")).toThrow(/non numériques/);
  });
});

describe("isChanId", () => {
  it("accepte uint64 décimal long (>= 10 chiffres)", () => {
    expect(isChanId("1099511627776")).toBe(true);
    expect(isChanId("944590169172045824")).toBe(true);
  });

  it("refuse les chaînes trop courtes ou non numériques", () => {
    expect(isChanId("123")).toBe(false);
    expect(isChanId("abc")).toBe(false);
    expect(isChanId("")).toBe(false);
    expect(isChanId("12.34")).toBe(false);
  });
});

describe("mapLndChannel", () => {
  it("mappe une réponse LND complète", () => {
    const raw = {
      channel_id: "944590169172045824",
      chan_point: "aabbcc:0",
      capacity: "5000000",
      node1_pub: "02aaa",
      node2_pub: "03bbb",
    };
    expect(mapLndChannel(raw, "fallback")).toEqual({
      id: "944590169172045824",
      shortId: null,
      capacity: 5_000_000,
      status: "active",
      transactionId: "aabbcc",
      transactionVout: 0,
      nodeLeftPub: "02aaa",
      nodeRightPub: "03bbb",
    });
  });

  it("retombe sur fallbackId si channel_id absent", () => {
    expect(mapLndChannel({}, "FALLBACK").id).toBe("FALLBACK");
  });

  it("tolère chan_point sans vout", () => {
    const out = mapLndChannel({ chan_point: "abc" }, "f");
    expect(out.transactionId).toBe("abc");
    expect(out.transactionVout).toBeNull();
  });

  it("capacity par défaut à 0 si absent", () => {
    expect(mapLndChannel({}, "f").capacity).toBe(0);
  });
});

describe("getLndConfig", () => {
  it("retourne null si URL manquante", () => {
    setEnv("LND_REST_URL", undefined);
    setEnv("LND_MACAROON_HEX", "deadbeef");
    expect(getLndConfig()).toBeNull();
  });

  it("retourne null si macaroon manquant", () => {
    setEnv("LND_REST_URL", "https://x:8080");
    setEnv("LND_MACAROON_HEX", undefined);
    expect(getLndConfig()).toBeNull();
  });

  it("retourne la config avec tlsInsecure=false par défaut", () => {
    setEnv("LND_REST_URL", "https://lnd.local:8080");
    setEnv("LND_MACAROON_HEX", "cafe");
    setEnv("LND_TLS_INSECURE", undefined);
    expect(getLndConfig()).toEqual({
      url: "https://lnd.local:8080",
      macaroonHex: "cafe",
      tlsInsecure: false,
    });
  });

  it("active tlsInsecure quand LND_TLS_INSECURE=1", () => {
    setEnv("LND_REST_URL", "https://lnd.local:8080");
    setEnv("LND_MACAROON_HEX", "cafe");
    setEnv("LND_TLS_INSECURE", "1");
    expect(getLndConfig()?.tlsInsecure).toBe(true);
  });
});
