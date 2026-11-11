/**
 * Test de couverture CSRF — P1.3.
 *
 * Verrouille le fait que toute route API de mutation (POST/PUT/PATCH/DELETE)
 * importe au moins un des helpers CSRF (`requireCsrf`, `requireRoleAndCsrf`).
 *
 * Une allowlist explicite liste les routes légitimement exemptes. Toute
 * nouvelle route de mutation sans CSRF **doit** être ajoutée consciemment
 * à l'allowlist, avec une justification.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const API_ROOT = join(__dirname, "../../app/api");

const MUTATION_RE = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\s*\(/;
const CSRF_RE = /\b(requireCsrf|requireRoleAndCsrf)\b/;

/**
 * Routes légitimement exemptes de CSRF. Chaque entrée **doit** être justifiée.
 * Clé : chemin relatif depuis `src/app/api/`.
 */
const ALLOWLIST: Record<string, string> = {
  "auth/route.ts":
    "Login / register / guest : pas de session préalable, CSRF n'a rien à protéger. Rate-limit IP sur guest.",
  "auth/verify-email/route.ts":
    "Confirmation par token magique dans URL. L'utilisateur n'est pas authentifié. Rate-limit 20/60s par IP.",
  "auth/verify-launch-token/route.ts":
    "Appelé en server-to-server par BitLab (SSO léger GandalNexus). Pas de session BitQuest — l'identité vient du JWT signé + nonce Redis anti-replay. Rate-limit IP strict (60/60s) + consommation unique du nonce. Documenté dans le header du fichier.",
  "auth/logout/route.ts":
    "Idempotent, rote le token côté serveur. Un attaquant qui déconnecte n'exfiltre rien. Documenté dans le header du fichier.",
  "health/route.ts": "Health check en lecture seule (pas de mutation réelle).",
  "route.ts": "Index API GET-only.",
};

function listRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      listRouteFiles(full, acc);
    } else if (entry === "route.ts") {
      acc.push(full);
    }
  }
  return acc;
}

describe("CSRF coverage — toutes les routes de mutation sont protégées", () => {
  const files = listRouteFiles(API_ROOT);

  it("au moins 20 routes API sont scannées (sanity)", () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it.each(files.map((f) => [f.replace(API_ROOT + "/", ""), f] as const))(
    "%s : CSRF ou allowlist",
    (rel, path) => {
      const content = readFileSync(path, "utf-8");
      const hasMutation = MUTATION_RE.test(content);
      if (!hasMutation) return; // Lecture seule → rien à vérifier.

      const hasCsrf = CSRF_RE.test(content);
      if (hasCsrf) return; // OK, protégée.

      const reason = ALLOWLIST[rel];
      expect(
        reason,
        `Route de mutation sans CSRF : ${rel}. Soit ajouter requireCsrf/requireRoleAndCsrf, soit l'ajouter à ALLOWLIST avec justification.`,
      ).toBeDefined();
    },
  );

  it("l'allowlist ne contient pas de références orphelines", () => {
    const existingRel = new Set(files.map((f) => f.replace(API_ROOT + "/", "")));
    for (const rel of Object.keys(ALLOWLIST)) {
      expect(existingRel.has(rel), `Allowlist pointe sur ${rel} qui n'existe plus`).toBe(true);
    }
  });
});
