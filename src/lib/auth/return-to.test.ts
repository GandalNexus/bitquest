import { describe, expect, it } from "vitest";
import { buildBitlabSsoRedirectUrl, isSafeReturnTo } from "./return-to";

describe("isSafeReturnTo", () => {
  it("accepte une URL http valide", () => {
    expect(isSafeReturnTo("http://localhost:3001/")).toBe(true);
  });

  it("accepte une URL https valide", () => {
    expect(isSafeReturnTo("https://bitlab.gandalnexus.io/")).toBe(true);
  });

  it("rejette javascript:", () => {
    expect(isSafeReturnTo("javascript:alert(1)")).toBe(false);
  });

  it("rejette data:", () => {
    expect(isSafeReturnTo("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejette les URLs relatives (non parseable sans base)", () => {
    expect(isSafeReturnTo("/bitlab")).toBe(false);
  });

  it("rejette les chaînes vides", () => {
    expect(isSafeReturnTo("")).toBe(false);
  });

  it("rejette null, undefined, number", () => {
    expect(isSafeReturnTo(null)).toBe(false);
    expect(isSafeReturnTo(undefined)).toBe(false);
    expect(isSafeReturnTo(42)).toBe(false);
  });

  it("rejette les URLs trop longues (> 2048 chars)", () => {
    const long = `https://x.io/${"a".repeat(2100)}`;
    expect(isSafeReturnTo(long)).toBe(false);
  });

  it("rejette les URLs malformées", () => {
    expect(isSafeReturnTo("http://[invalid")).toBe(false);
    expect(isSafeReturnTo("ht!tp://nope")).toBe(false);
  });

  it("accepte les URLs avec query params et fragment", () => {
    expect(isSafeReturnTo("https://bitlab.io/?foo=bar#section")).toBe(true);
  });
});

describe("buildBitlabSsoRedirectUrl", () => {
  it("construit l'URL de rebond SSO avec returnTo encodé", () => {
    const url = buildBitlabSsoRedirectUrl("http://localhost:3001/");
    expect(url).toBe(
      "/api/auth/bitlab-sso?returnTo=http%3A%2F%2Flocalhost%3A3001%2F",
    );
  });

  it("encode correctement les caractères spéciaux", () => {
    const url = buildBitlabSsoRedirectUrl("https://x.io/?a=b&c=d");
    expect(url).toContain("returnTo=https%3A%2F%2Fx.io%2F%3Fa%3Db%26c%3Dd");
  });
});
