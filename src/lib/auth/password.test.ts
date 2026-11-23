/**
 * Tests unitaires `password.ts` — source unique de vérité pour
 * hashPassword/verifyPassword (Phase sécurité).
 *
 * Objectifs :
 *   - Roundtrip hash → verify doit toujours matcher.
 *   - Rejet silencieux (false, pas de throw) sur tout input malformé.
 *   - timingSafeEqual ne reçoit JAMAIS des buffers de tailles ≠ (sinon
 *     RangeError qui ferait crasher la route — bug historique corrigé).
 *   - Charset hex strict sur les deux moitiés.
 *   - Compat 100 % avec le format existant en DB (salt 32 hex + ':' + hash 64 hex).
 */

import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  HASH_BYTES,
  SALT_BYTES,
} from "./password";

describe("hashPassword", () => {
  it("produit un format <32 hex>:<64 hex>", () => {
    const stored = hashPassword("azertyuiop");
    const parts = stored.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(SALT_BYTES * 2);
    expect(parts[1]).toHaveLength(HASH_BYTES * 2);
    expect(parts[0]).toMatch(/^[0-9a-f]+$/);
    expect(parts[1]).toMatch(/^[0-9a-f]+$/);
  });

  it("non-déterministe : deux appels successifs → salts différents", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(a.split(":")[0]).not.toBe(b.split(":")[0]);
  });
});

describe("verifyPassword — roundtrip", () => {
  it("matche le mot de passe correct", () => {
    const stored = hashPassword("azertyuiop");
    expect(verifyPassword("azertyuiop", stored)).toBe(true);
  });

  it("rejette un mot de passe incorrect", () => {
    const stored = hashPassword("azertyuiop");
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("rejette une variante à 1 char près", () => {
    const stored = hashPassword("azertyuiop");
    expect(verifyPassword("azertyuioP", stored)).toBe(false); // casse majuscule
    expect(verifyPassword("azertyuio", stored)).toBe(false); // char manquant
    expect(verifyPassword("azertyuiopp", stored)).toBe(false); // char en trop
  });

  it("gère les mots de passe avec caractères unicode / spéciaux", () => {
    const pwds = ["mot de passe", "Ñoël@2026!", "🔑secret🔒", "¡Hola! #admin"];
    for (const p of pwds) {
      const s = hashPassword(p);
      expect(verifyPassword(p, s)).toBe(true);
      expect(verifyPassword(p + "x", s)).toBe(false);
    }
  });
});

describe("verifyPassword — format invalide (ne throw jamais)", () => {
  it("stored null / undefined / vide → false", () => {
    expect(verifyPassword("whatever", null)).toBe(false);
    expect(verifyPassword("whatever", undefined)).toBe(false);
    expect(verifyPassword("whatever", "")).toBe(false);
  });

  it("stored sans ':' → false", () => {
    expect(verifyPassword("whatever", "0123456789abcdef0123456789abcdef")).toBe(false);
    expect(verifyPassword("whatever", "no-colon-here")).toBe(false);
  });

  it("stored avec plusieurs ':' → false (empêche les injections format)", () => {
    const valid = hashPassword("pw");
    const [salt, hash] = valid.split(":");
    expect(verifyPassword("pw", `${salt}:${hash}:extra`)).toBe(false);
    expect(verifyPassword("pw", `${salt}::${hash}`)).toBe(false);
  });

  it("salt vide ou hash vide → false", () => {
    const valid = hashPassword("pw");
    const [salt, hash] = valid.split(":");
    expect(verifyPassword("pw", `:${hash}`)).toBe(false);
    expect(verifyPassword("pw", `${salt}:`)).toBe(false);
    expect(verifyPassword("pw", ":")).toBe(false);
  });
});

describe("verifyPassword — longueur hash / salt", () => {
  it("hash de longueur != 64 → false (comparaison de buffers différents jamais atteinte)", () => {
    const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
    // Hash tronqué (32 chars au lieu de 64) — bug historique : auth/route.ts
    // ne vérifiait pas et timingSafeEqual jetait un RangeError → 500.
    const truncated = "a".repeat(32);
    expect(() => verifyPassword("pw", `${salt}:${truncated}`)).not.toThrow();
    expect(verifyPassword("pw", `${salt}:${truncated}`)).toBe(false);
  });

  it("hash plus long que 64 → false", () => {
    const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
    const tooLong = "a".repeat(128);
    expect(verifyPassword("pw", `${salt}:${tooLong}`)).toBe(false);
  });

  it("salt de longueur != 32 → false", () => {
    const hash = "a".repeat(64);
    expect(verifyPassword("pw", `short:${hash}`)).toBe(false);
    expect(verifyPassword("pw", `${"a".repeat(64)}:${hash}`)).toBe(false); // salt 64 au lieu de 32
  });

  it("réel : salt 1 byte vs hash 32 bytes → fail-closed sans crash", () => {
    // Scénario : row DB corrompue par une migration bancale.
    expect(() => verifyPassword("pw", "00:" + "a".repeat(64))).not.toThrow();
    expect(verifyPassword("pw", "00:" + "a".repeat(64))).toBe(false);
  });
});

describe("verifyPassword — charset hex strict", () => {
  it("salt non-hex (lettres > f) → false", () => {
    const hash = "a".repeat(64);
    expect(verifyPassword("pw", `zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz:${hash}`)).toBe(false);
  });

  it("hash non-hex → false (Buffer.from('xyz', 'hex') produit du garbage)", () => {
    const salt = "a".repeat(32);
    const nonHex = "g".repeat(64); // 'g' n'est pas hex
    expect(verifyPassword("pw", `${salt}:${nonHex}`)).toBe(false);
  });

  it("hashPassword produit systématiquement du hex lowercase (invariant DB)", () => {
    // La DB historique stocke du lowercase (Node .toString('hex') par défaut).
    // Pas de normalisation côté verify → on documente l'invariant producer.
    for (let i = 0; i < 5; i++) {
      const stored = hashPassword("pw-" + i);
      expect(stored).toBe(stored.toLowerCase());
    }
  });

  it("charset uppercase passe la regex mais ne matche pas (salt casse-sensible côté kdf)", () => {
    // La regex est /^[0-9a-f]+$/i → les chars uppercase passent le guard.
    // MAIS scryptSync traite le salt comme une string : "ABC" ≠ "abc" en kdf.
    // Un stored uppercased ne peut donc pas valider son password original.
    // → false sans throw, comportement sécuritaire attendu.
    const stored = hashPassword("pw");
    const upper = stored.toUpperCase();
    expect(() => verifyPassword("pw", upper)).not.toThrow();
    expect(verifyPassword("pw", upper)).toBe(false);
  });

  it("espaces dans salt / hash → false", () => {
    const stored = hashPassword("pw");
    const [salt, hash] = stored.split(":");
    const spaced = salt.replace(/^./, " "); // premier char remplacé par espace
    expect(verifyPassword("pw", `${spaced}:${hash}`)).toBe(false);
  });
});

describe("verifyPassword — robustesse mot de passe entrant", () => {
  it("mot de passe vide → false sans throw", () => {
    const stored = hashPassword("real");
    expect(() => verifyPassword("", stored)).not.toThrow();
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("mot de passe très long → pas de crash", () => {
    const stored = hashPassword("short");
    const huge = "a".repeat(10_000);
    expect(() => verifyPassword(huge, stored)).not.toThrow();
    expect(verifyPassword(huge, stored)).toBe(false);
  });
});
