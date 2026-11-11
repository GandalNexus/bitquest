import { describe, it, expect } from "vitest";
import {
  buildBitlabDeepLink,
  parseBitlabReturn,
  signDeepLinkPayload,
  verifyDeepLinkPayload,
} from "./deep-link";

describe("buildBitlabDeepLink", () => {
  it("encode les paramètres obligatoires", () => {
    const url = buildBitlabDeepLink({
      base: "https://bitlab.example/mission",
      questCode: "tx-basics",
      kind: "TX",
      network: "testnet4",
      returnTo: "https://bitquest.local/quests/tx-basics",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://bitlab.example/mission");
    expect(parsed.searchParams.get("questCode")).toBe("tx-basics");
    expect(parsed.searchParams.get("kind")).toBe("TX");
    expect(parsed.searchParams.get("network")).toBe("testnet4");
    expect(parsed.searchParams.get("returnTo")).toBe(
      "https://bitquest.local/quests/tx-basics",
    );
  });

  it("ajoute les extras non-null et ignore undefined", () => {
    const url = buildBitlabDeepLink({
      base: "https://bitlab.example/mission",
      questCode: "tx-basics",
      kind: "TX",
      network: "testnet4",
      returnTo: "https://bitquest.local/q",
      extra: { target: 45000, feeSats: undefined, nonce: "abc" },
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("target")).toBe("45000");
    expect(parsed.searchParams.get("nonce")).toBe("abc");
    expect(parsed.searchParams.has("feeSats")).toBe(false);
  });

  it("gère un base qui contient déjà des params (merge non destructif)", () => {
    const url = buildBitlabDeepLink({
      base: "https://bitlab.example/mission?theme=dark",
      questCode: "x",
      kind: "TX",
      network: "testnet4",
      returnTo: "https://bitquest.local",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("theme")).toBe("dark");
    expect(parsed.searchParams.get("questCode")).toBe("x");
  });

  it("URL-encode les valeurs avec caractères spéciaux", () => {
    const url = buildBitlabDeepLink({
      base: "https://bitlab.example/mission",
      questCode: "x",
      kind: "TX",
      network: "testnet4",
      returnTo: "https://bitquest.local/q?code=tx-basics&x=1",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("returnTo")).toBe(
      "https://bitquest.local/q?code=tx-basics&x=1",
    );
  });
});

describe("parseBitlabReturn", () => {
  const hex64 = "a".repeat(64);

  it("retourne null si bitlab_result absent", () => {
    const params = new URLSearchParams(`kind=TX&network=testnet4&txid=${hex64}`);
    expect(parseBitlabReturn(params)).toBeNull();
  });

  it("parse une transaction valide", () => {
    const params = new URLSearchParams(
      `bitlab_result=1&kind=TX&network=testnet4&txid=${hex64}`,
    );
    expect(parseBitlabReturn(params)).toEqual({
      kind: "TX",
      network: "testnet4",
      value: hex64,
    });
  });

  it("parse un bloc via hash", () => {
    const params = new URLSearchParams(
      `bitlab_result=1&kind=BLOCK&network=signet&hash=${hex64}`,
    );
    expect(parseBitlabReturn(params)).toEqual({
      kind: "BLOCK",
      network: "signet",
      value: hex64,
    });
  });

  it("refuse un kind inconnu", () => {
    const params = new URLSearchParams(
      `bitlab_result=1&kind=FOO&network=testnet4&txid=${hex64}`,
    );
    expect(parseBitlabReturn(params)).toBeNull();
  });

  it("refuse un hex64 mal formé", () => {
    const params = new URLSearchParams(
      `bitlab_result=1&kind=TX&network=testnet4&txid=short`,
    );
    expect(parseBitlabReturn(params)).toBeNull();
  });

  it("refuse si network manque", () => {
    const params = new URLSearchParams(
      `bitlab_result=1&kind=TX&txid=${hex64}`,
    );
    expect(parseBitlabReturn(params)).toBeNull();
  });

  it("normalise en minuscules et trim", () => {
    const upper = "A".repeat(64);
    const params = new URLSearchParams(
      `bitlab_result=1&kind=TX&network=testnet4&txid=${upper}`,
    );
    expect(parseBitlabReturn(params)?.value).toBe("a".repeat(64));
  });

  it("parse une invoice BOLT11 valide (bolt11=)", () => {
    const invoice = "lntb100n1pabcdefghij";
    const params = new URLSearchParams(
      `bitlab_result=1&kind=INVOICE&network=testnet4&bolt11=${invoice}`,
    );
    expect(parseBitlabReturn(params)).toEqual({
      kind: "INVOICE",
      network: "testnet4",
      value: invoice,
    });
  });

  it("refuse une invoice BOLT11 mal formée (manque ln)", () => {
    const params = new URLSearchParams(
      `bitlab_result=1&kind=INVOICE&network=testnet4&bolt11=garbage123`,
    );
    expect(parseBitlabReturn(params)).toBeNull();
  });

  it("parse un scid CHANNEL (format <b>x<t>x<v>)", () => {
    const params = new URLSearchParams(
      `bitlab_result=1&kind=CHANNEL&network=testnet4&scid=859100x1234x0`,
    );
    expect(parseBitlabReturn(params)?.value).toBe("859100x1234x0");
  });

  it("parse un chan_id CHANNEL (uint64 décimal)", () => {
    const params = new URLSearchParams(
      `bitlab_result=1&kind=CHANNEL&network=testnet4&scid=944590439503233024`,
    );
    expect(parseBitlabReturn(params)?.value).toBe("944590439503233024");
  });

  it("parse une adresse ADDRESS (bech32)", () => {
    const params = new URLSearchParams(
      `bitlab_result=1&kind=ADDRESS&network=testnet4&address=tb1qexampleaddress123`,
    );
    expect(parseBitlabReturn(params)?.value).toBe("tb1qexampleaddress123");
  });
});

describe("signDeepLinkPayload / verifyDeepLinkPayload", () => {
  const baseArgs = {
    userId: "user_abc",
    questCode: "tx-basics",
    kind: "TX" as const,
    network: "testnet4",
    secret: "s3cret-hmac-key-at-least-16-bytes",
  };

  it("produit une signature stable pour les mêmes inputs", () => {
    const ts = 1_700_000_000;
    const a = signDeepLinkPayload({ ...baseArgs, ts });
    const b = signDeepLinkPayload({ ...baseArgs, ts });
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(20); // base64url(32 bytes) ≈ 43 chars
  });

  it("change la signature quand un champ change", () => {
    const ts = 1_700_000_000;
    const base = signDeepLinkPayload({ ...baseArgs, ts });
    expect(signDeepLinkPayload({ ...baseArgs, ts, questCode: "utxo" })).not.toBe(base);
    expect(signDeepLinkPayload({ ...baseArgs, ts, network: "signet" })).not.toBe(base);
    expect(signDeepLinkPayload({ ...baseArgs, ts, kind: "BLOCK" })).not.toBe(base);
    expect(signDeepLinkPayload({ ...baseArgs, ts, userId: "other" })).not.toBe(base);
    expect(signDeepLinkPayload({ ...baseArgs, ts: ts + 1 })).not.toBe(base);
  });

  it("vérifie une signature fraîche", () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = signDeepLinkPayload({ ...baseArgs, ts });
    expect(verifyDeepLinkPayload({ ...baseArgs, ts, sig })).toBe(true);
  });

  it("refuse une signature altérée", () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = signDeepLinkPayload({ ...baseArgs, ts });
    const tampered = sig.slice(0, -2) + "XX";
    expect(verifyDeepLinkPayload({ ...baseArgs, ts, sig: tampered })).toBe(false);
  });

  it("refuse une signature expirée (>1h)", () => {
    const ts = Math.floor(Date.now() / 1000) - 60 * 60 - 1;
    const sig = signDeepLinkPayload({ ...baseArgs, ts });
    expect(verifyDeepLinkPayload({ ...baseArgs, ts, sig })).toBe(false);
  });

  it("refuse un ts dans le futur (clock skew)", () => {
    const ts = Math.floor(Date.now() / 1000) + 60 * 60;
    const sig = signDeepLinkPayload({ ...baseArgs, ts });
    expect(verifyDeepLinkPayload({ ...baseArgs, ts, sig })).toBe(false);
  });

  it("refuse si userId ou quest ne correspondent plus au contexte", () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = signDeepLinkPayload({ ...baseArgs, ts });
    expect(
      verifyDeepLinkPayload({ ...baseArgs, ts, sig, userId: "someone-else" }),
    ).toBe(false);
    expect(
      verifyDeepLinkPayload({ ...baseArgs, ts, sig, questCode: "utxo" }),
    ).toBe(false);
  });

  it("refuse une signature base64 invalide proprement (pas de throw)", () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(
      verifyDeepLinkPayload({ ...baseArgs, ts, sig: "###not-base64###" }),
    ).toBe(false);
  });
});
