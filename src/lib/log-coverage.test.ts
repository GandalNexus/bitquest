/**
 * Test de couverture Logger — P1.5.
 *
 * Verrouille le fait qu'aucun fichier de `src/` n'utilise `console.*`
 * directement : tout doit passer par `logger("scope")` (pino + redaction
 * + relais Sentry automatique sur .error()).
 *
 * Allowlist : les fichiers de setup (ex. sentry config) qui ont besoin
 * de logger via console avant que pino soit chargé.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC_ROOT = join(__dirname, "..");

const CONSOLE_RE = /\bconsole\.(log|error|warn|info|debug|trace)\s*\(/;

/**
 * Fichiers explicitement autorisés à utiliser `console.*`.
 * Clé : chemin relatif depuis `src/`.
 */
const ALLOWLIST: Record<string, string> = {
  // Aucun pour l'instant — tout le monde passe par logger().
};

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      listSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Logger coverage — pas de console.* dans src/", () => {
  const files = listSourceFiles(SRC_ROOT);

  it("au moins 100 fichiers src/ sont scannés (sanity)", () => {
    expect(files.length).toBeGreaterThanOrEqual(100);
  });

  it("aucun fichier src/ (hors allowlist) n'utilise console.*", () => {
    const offenders: string[] = [];
    for (const path of files) {
      const rel = path.replace(SRC_ROOT + "/", "");
      if (rel in ALLOWLIST) continue;
      const content = readFileSync(path, "utf-8");
      if (CONSOLE_RE.test(content)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      `Fichiers utilisant console.* au lieu de logger(): ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("l'allowlist ne contient pas de références orphelines", () => {
    const existingRel = new Set(files.map((f) => f.replace(SRC_ROOT + "/", "")));
    for (const rel of Object.keys(ALLOWLIST)) {
      expect(existingRel.has(rel), `Allowlist pointe sur ${rel} qui n'existe plus`).toBe(true);
    }
  });
});
