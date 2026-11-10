import { describe, it, expect } from "vitest";
import { rateLimitInMemory } from "./session";

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
