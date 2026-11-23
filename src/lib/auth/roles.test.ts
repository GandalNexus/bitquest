import { describe, it, expect } from "vitest";
import {
  ROLES,
  hasAtLeastRole,
  isRole,
  normalizeRole,
  forbidden,
} from "./roles";

describe("ROLES", () => {
  it("expose les trois rôles dans l'ordre hiérarchique", () => {
    expect(ROLES).toEqual(["APPRENTICE", "EDITOR", "ADMIN"]);
  });
});

describe("isRole", () => {
  it("retourne true pour chaque rôle valide", () => {
    for (const r of ROLES) {
      expect(isRole(r)).toBe(true);
    }
  });

  it("retourne false pour une valeur inconnue", () => {
    expect(isRole("GOD")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(42)).toBe(false);
    expect(isRole({})).toBe(false);
  });
});

describe("normalizeRole", () => {
  it("laisse un rôle valide intact", () => {
    expect(normalizeRole("ADMIN")).toBe("ADMIN");
    expect(normalizeRole("EDITOR")).toBe("EDITOR");
    expect(normalizeRole("APPRENTICE")).toBe("APPRENTICE");
  });

  it("retourne APPRENTICE pour une valeur inconnue (sécurité par défaut)", () => {
    expect(normalizeRole("GOD")).toBe("APPRENTICE");
    expect(normalizeRole(null)).toBe("APPRENTICE");
    expect(normalizeRole(undefined)).toBe("APPRENTICE");
    expect(normalizeRole("")).toBe("APPRENTICE");
  });
});

describe("hasAtLeastRole", () => {
  it("APPRENTICE satisfait APPRENTICE uniquement", () => {
    expect(hasAtLeastRole("APPRENTICE", "APPRENTICE")).toBe(true);
    expect(hasAtLeastRole("APPRENTICE", "EDITOR")).toBe(false);
    expect(hasAtLeastRole("APPRENTICE", "ADMIN")).toBe(false);
  });

  it("EDITOR satisfait APPRENTICE et EDITOR", () => {
    expect(hasAtLeastRole("EDITOR", "APPRENTICE")).toBe(true);
    expect(hasAtLeastRole("EDITOR", "EDITOR")).toBe(true);
    expect(hasAtLeastRole("EDITOR", "ADMIN")).toBe(false);
  });

  it("ADMIN satisfait tous les niveaux", () => {
    expect(hasAtLeastRole("ADMIN", "APPRENTICE")).toBe(true);
    expect(hasAtLeastRole("ADMIN", "EDITOR")).toBe(true);
    expect(hasAtLeastRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("une valeur inconnue est traitée comme APPRENTICE (verrouille)", () => {
    expect(hasAtLeastRole("GOD", "APPRENTICE")).toBe(true);
    expect(hasAtLeastRole("GOD", "EDITOR")).toBe(false);
    expect(hasAtLeastRole(null, "EDITOR")).toBe(false);
    expect(hasAtLeastRole(undefined, "ADMIN")).toBe(false);
  });
});

describe("forbidden", () => {
  it("renvoie une Response 403 avec un message par défaut", async () => {
    const res = forbidden();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "Accès refusé : rôle insuffisant." });
  });

  it("accepte un message personnalisé", async () => {
    const res = forbidden("Besoin ADMIN.");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "Besoin ADMIN." });
  });
});
