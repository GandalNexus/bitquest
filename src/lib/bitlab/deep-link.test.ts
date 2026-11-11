import { describe, it, expect } from "vitest";
import { buildBitlabDeepLink, parseBitlabReturn } from "./deep-link";

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
});
