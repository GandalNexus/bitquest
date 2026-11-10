import { describe, it, expect } from "vitest";
import { rateLimit } from "./session";

/* ------------------------------------------------------------------ */
/* rateLimit                                                           */
/*                                                                     */
/* Fenêtre glissante en mémoire. Chaque appel enregistre un hit pour   */
/* la clé fournie. Les appels au-delà de `max` dans `windowMs`         */
/* retournent `false`.                                                 */
/* ------------------------------------------------------------------ */

function uniqueKey(prefix: string) {
  return `${prefix}:${Math.random().toString(36).slice(2)}:${Date.now()}`;
}

describe("rateLimit", () => {
  it("autorise jusqu'à `max` appels puis refuse", () => {
    const key = uniqueKey("burst");
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 1000)).toBe(true);
    }
    expect(rateLimit(key, 5, 1000)).toBe(false);
  });

  it("isole les clés — un rate limit sur K1 ne touche pas K2", () => {
    const k1 = uniqueKey("iso-k1");
    const k2 = uniqueKey("iso-k2");
    for (let i = 0; i < 3; i++) expect(rateLimit(k1, 3, 1000)).toBe(true);
    expect(rateLimit(k1, 3, 1000)).toBe(false); // k1 saturé
    expect(rateLimit(k2, 3, 1000)).toBe(true);  // k2 encore libre
  });

  it("gère un max de 0 : refuse systématiquement", () => {
    const key = uniqueKey("zero");
    expect(rateLimit(key, 0, 1000)).toBe(false);
    expect(rateLimit(key, 0, 1000)).toBe(false);
  });

  it("gère un max de 1 : accepte une fois puis refuse", () => {
    const key = uniqueKey("one");
    expect(rateLimit(key, 1, 1000)).toBe(true);
    expect(rateLimit(key, 1, 1000)).toBe(false);
  });

  it("ne libère pas de place avant l'expiration de la fenêtre", () => {
    const key = uniqueKey("window");
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 10_000)).toBe(true);
    // appels successifs dans la même fenêtre
    expect(rateLimit(key, 3, 10_000)).toBe(false);
    expect(rateLimit(key, 3, 10_000)).toBe(false);
  });
});
