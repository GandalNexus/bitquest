/**
 * Test de couverture Zod — P1.4.
 *
 * Verrouille le fait qu'aucune route API n'appelle `req.json()` directement
 * sans passer par `parseJsonBody(req, schema)` — qui fait le parsing JSON +
 * la validation Zod + la réponse 400 formatée.
 *
 * Toute route de mutation (POST/PUT/PATCH/DELETE) qui lit un body JSON doit
 * passer par ce helper. Si on détecte un `req.json()` nu dans le futur,
 * le test échoue et oblige à ajouter un schéma Zod explicite.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const API_ROOT = join(__dirname, "../../app/api");

const RAW_JSON_RE = /\b(?:req|request)\.json\s*\(\)/;

function listRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) listRouteFiles(full, acc);
    else if (entry === "route.ts") acc.push(full);
  }
  return acc;
}

describe("Zod coverage — pas de req.json() nu dans les routes API", () => {
  const files = listRouteFiles(API_ROOT);

  it("au moins 20 routes sont scannées (sanity)", () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it.each(files.map((f) => [f.replace(API_ROOT + "/", ""), f] as const))(
    "%s n'appelle pas req.json() directement",
    (_rel, path) => {
      const content = readFileSync(path, "utf-8");
      // Match toute occurrence `req.json()` ou `request.json()`.
      const hasRawJson = RAW_JSON_RE.test(content);
      expect(
        hasRawJson,
        "Route API utilisant req.json() directement — doit passer par parseJsonBody(req, schema) pour la validation Zod.",
      ).toBe(false);
    },
  );
});
