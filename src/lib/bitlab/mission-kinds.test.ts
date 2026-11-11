import { describe, expect, it } from "vitest";
import { toBitlabKind, isBitlabNetwork } from "./mission-kinds";

describe("toBitlabKind", () => {
  it("mappe tx_builder → TX", () => {
    expect(toBitlabKind("tx_builder")).toBe("TX");
  });

  it("mappe block_explorer → BLOCK", () => {
    expect(toBitlabKind("block_explorer")).toBe("BLOCK");
  });

  it("mappe lightning_pay → INVOICE", () => {
    expect(toBitlabKind("lightning_pay")).toBe("INVOICE");
  });

  it("mappe channel_open → CHANNEL", () => {
    expect(toBitlabKind("channel_open")).toBe("CHANNEL");
  });

  it("mappe address_derive → ADDRESS", () => {
    expect(toBitlabKind("address_derive")).toBe("ADDRESS");
  });

  it("retombe sur TX pour un missionType inconnu", () => {
    expect(toBitlabKind("unknown_type")).toBe("TX");
    expect(toBitlabKind("")).toBe("TX");
  });
});

describe("isBitlabNetwork", () => {
  it("accepte les trois réseaux supportés", () => {
    expect(isBitlabNetwork("testnet4")).toBe(true);
    expect(isBitlabNetwork("signet")).toBe(true);
    expect(isBitlabNetwork("regtest")).toBe(true);
  });

  it("refuse mainnet et valeurs arbitraires", () => {
    expect(isBitlabNetwork("mainnet")).toBe(false);
    expect(isBitlabNetwork("TESTNET4")).toBe(false);
    expect(isBitlabNetwork("")).toBe(false);
  });
});
