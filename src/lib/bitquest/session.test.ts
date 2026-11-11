import { describe, it, expect } from "vitest";
import { clientIp, rateLimitInMemory } from "./session";

/* ------------------------------------------------------------------ */
/* rateLimit (backend in-memory)                                       */
/*                                                                     */
/* Fenêtre glissante en mémoire. Chaque appel enregistre un hit pour   */
/* la clé fournie. Les appels au-delà de `max` dans `windowMs`         */
/* retournent `false`.                                                 */
/*                                                                     */
/* Depuis Phase 1.4, rateLimit() est async et tente Redis d'abord.     */
/* Les tests portent sur le backend in-memory pur.                     */
/* ------------------------------------------------------------------ */

function uniqueKey(prefix: string) {
  return `${prefix}:${Math.random().toString(36).slice(2)}:${Date.now()}`;
}

describe("rateLimitInMemory", () => {
  it("autorise jusqu'à `max` appels puis refuse", () => {
    const key = uniqueKey("burst");
    for (let i = 0; i < 5; i++) {
      expect(rateLimitInMemory(key, 5, 1000)).toBe(true);
    }
    expect(rateLimitInMemory(key, 5, 1000)).toBe(false);
  });

  it("isole les clés — un rate limit sur K1 ne touche pas K2", () => {
    const k1 = uniqueKey("iso-k1");
    const k2 = uniqueKey("iso-k2");
    for (let i = 0; i < 3; i++) expect(rateLimitInMemory(k1, 3, 1000)).toBe(true);
    expect(rateLimitInMemory(k1, 3, 1000)).toBe(false); // k1 saturé
    expect(rateLimitInMemory(k2, 3, 1000)).toBe(true); // k2 encore libre
  });

  it("gère un max de 0 : refuse systématiquement", () => {
    const key = uniqueKey("zero");
    expect(rateLimitInMemory(key, 0, 1000)).toBe(false);
    expect(rateLimitInMemory(key, 0, 1000)).toBe(false);
  });

  it("gère un max de 1 : accepte une fois puis refuse", () => {
    const key = uniqueKey("one");
    expect(rateLimitInMemory(key, 1, 1000)).toBe(true);
    expect(rateLimitInMemory(key, 1, 1000)).toBe(false);
  });

  it("ne libère pas de place avant l'expiration de la fenêtre", () => {
    const key = uniqueKey("window");
    for (let i = 0; i < 3; i++) expect(rateLimitInMemory(key, 3, 10_000)).toBe(true);
    expect(rateLimitInMemory(key, 3, 10_000)).toBe(false);
    expect(rateLimitInMemory(key, 3, 10_000)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* clientIp — extraction de l'IP client depuis les headers HTTP        */
/* ------------------------------------------------------------------ */

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/x", { method: "POST", headers });
}

describe("clientIp", () => {
  it("lit x-forwarded-for en priorité", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("prend la première IP d'une chaîne x-forwarded-for", () => {
    expect(
      clientIp(reqWith({ "x-forwarded-for": "203.0.113.1, 10.0.0.1, 10.0.0.2" })),
    ).toBe("203.0.113.1");
  });

  it("trim les espaces autour de la première IP", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "  1.2.3.4  , 5.6.7.8" }))).toBe(
      "1.2.3.4",
    );
  });

  it("fallback sur x-real-ip si x-forwarded-for est absent", () => {
    expect(clientIp(reqWith({ "x-real-ip": "198.51.100.42" }))).toBe("198.51.100.42");
  });

  it("préfère x-forwarded-for à x-real-ip", () => {
    expect(
      clientIp(
        reqWith({
          "x-forwarded-for": "1.2.3.4",
          "x-real-ip": "198.51.100.42",
        }),
      ),
    ).toBe("1.2.3.4");
  });

  it("retourne 'unknown' si aucun header n'est présent", () => {
    expect(clientIp(reqWith({}))).toBe("unknown");
  });

  it("retourne 'unknown' si x-forwarded-for est vide", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "" }))).toBe("unknown");
  });

  it("supporte l'IPv6", () => {
    const ipv6 = "2001:db8::1";
    expect(clientIp(reqWith({ "x-forwarded-for": ipv6 }))).toBe(ipv6);
  });
});
