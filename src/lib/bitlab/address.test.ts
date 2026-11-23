import { describe, it, expect } from "vitest";
import {
  ADDRESS_VERIFY_LEVELS,
  DEFAULT_ADDRESS_VERIFY_LEVEL,
  parseAddressVerifyLevel,
  validateAddressFormat,
} from "./address";

describe("validateAddressFormat — testnet4 & signet", () => {
  // Valeurs d'exemple (sans checksum réel ; la regex vérifie format + longueur).
  const bech32V0 = "tb1qar0srrr7xfkvy5l643lydnw9re59gtzzwfhapy"; // P2WPKH testnet
  const bech32V1 = "tb1pqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsjjlhc"; // P2TR-ish
  const base58P2PKH = "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn"; // P2PKH testnet
  const base58P2SH = "2N2JD6wb56AfK4tfmM6PwdVmoYk2dCKf4Br"; // P2SH testnet

  it.each([
    ["bech32 v0", bech32V0, "bech32"],
    ["bech32 v1", bech32V1, "bech32"],
    ["base58 P2PKH", base58P2PKH, "base58"],
    ["base58 P2SH", base58P2SH, "base58"],
  ])("accepte %s sur testnet4", (_label, addr, expected) => {
    const res = validateAddressFormat("testnet4", addr);
    expect(res.valid).toBe(true);
    expect(res.format).toBe(expected);
  });

  it("accepte les mêmes adresses sur signet (même préfixe)", () => {
    expect(validateAddressFormat("signet", bech32V0).valid).toBe(true);
    expect(validateAddressFormat("signet", base58P2PKH).valid).toBe(true);
  });

  it("rejette une adresse mainnet (bc1…) sur testnet4", () => {
    const res = validateAddressFormat(
      "testnet4",
      "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("tb1");
  });

  it("rejette une adresse regtest (bcrt1…) sur testnet4", () => {
    const res = validateAddressFormat(
      "testnet4",
      "bcrt1qar0srrr7xfkvy5l643lydnw9re59gtzzwfhapy",
    );
    expect(res.valid).toBe(false);
  });

  it("rejette une chaîne vide", () => {
    expect(validateAddressFormat("testnet4", "").valid).toBe(false);
    expect(validateAddressFormat("testnet4", "   ").valid).toBe(false);
  });

  it("rejette une adresse trop longue (> 100 chars)", () => {
    const tooLong = "tb1" + "q".repeat(100);
    expect(validateAddressFormat("testnet4", tooLong).valid).toBe(false);
  });

  it("rejette une adresse bech32 avec un caractère interdit (1)", () => {
    // Le charset bech32 exclut explicitement '1' hors séparateur.
    const bad = "tb1q11111111111111111111111111111111111111";
    expect(validateAddressFormat("testnet4", bad).valid).toBe(false);
  });

  it("trim les whitespaces", () => {
    const res = validateAddressFormat("testnet4", `  ${base58P2PKH}  `);
    expect(res.valid).toBe(true);
  });
});

describe("validateAddressFormat — regtest", () => {
  const bcrt = "bcrt1qar0srrr7xfkvy5l643lydnw9re59gtzzwfhapy";

  it("accepte bcrt1 bech32", () => {
    expect(validateAddressFormat("regtest", bcrt)).toEqual({
      valid: true,
      format: "bech32",
    });
  });

  it("rejette tb1 sur regtest", () => {
    const res = validateAddressFormat(
      "regtest",
      "tb1qar0srrr7xfkvy5l643lydnw9re59gtzzwfhapy",
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("bcrt1");
  });
});

describe("validateAddressFormat — mainnet refusé", () => {
  it("rejette toute adresse sur mainnet (hors scope BitQuest v1)", () => {
    const res = validateAddressFormat(
      "mainnet",
      "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("mainnet");
  });
});

describe("parseAddressVerifyLevel", () => {
  it("retourne FORMAT par défaut quand missionConfig est vide/null/undefined", () => {
    expect(parseAddressVerifyLevel(null)).toBe("FORMAT");
    expect(parseAddressVerifyLevel(undefined)).toBe("FORMAT");
    expect(parseAddressVerifyLevel("")).toBe("FORMAT");
    expect(DEFAULT_ADDRESS_VERIFY_LEVEL).toBe("FORMAT");
  });

  it("lit USED depuis missionConfig JSON", () => {
    expect(parseAddressVerifyLevel('{"addressVerifyLevel":"USED"}')).toBe("USED");
  });

  it("lit FORMAT explicite depuis missionConfig JSON", () => {
    expect(parseAddressVerifyLevel('{"addressVerifyLevel":"FORMAT"}')).toBe("FORMAT");
  });

  it("fallback FORMAT pour un niveau inconnu", () => {
    expect(parseAddressVerifyLevel('{"addressVerifyLevel":"FULL_NODE"}')).toBe("FORMAT");
  });

  it("fallback FORMAT pour un JSON invalide", () => {
    expect(parseAddressVerifyLevel("not-json")).toBe("FORMAT");
  });

  it("fallback FORMAT quand le champ est absent", () => {
    expect(parseAddressVerifyLevel('{"brief":"hello"}')).toBe("FORMAT");
  });

  it("expose les deux niveaux via ADDRESS_VERIFY_LEVELS", () => {
    expect(ADDRESS_VERIFY_LEVELS).toEqual(["FORMAT", "USED"]);
  });
});
