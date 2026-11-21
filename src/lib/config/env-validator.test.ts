import { describe, it, expect, afterEach, vi } from "vitest";
import { validateEnv, currentEnv, validateOrThrow } from "./env-validator";

afterEach(() => {
  vi.unstubAllEnvs();
});

const SECRET_32 = "a".repeat(32);
const SECRET_32_B = "b".repeat(32);

function setupProdValid() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://user:pass@host:5432/db");
  vi.stubEnv("REDIS_URL", "redis://redis.prod:6379");
  vi.stubEnv("CSRF_SECRET", SECRET_32);
  vi.stubEnv("BITLAB_JWT_SECRET", SECRET_32 + "1");
  vi.stubEnv("BITLAB_LAUNCH_SECRET", SECRET_32 + "2");
  vi.stubEnv("BITLAB_SIGN_SECRET", SECRET_32 + "3");
  vi.stubEnv("CERTIFICATE_SIGN_SECRET", SECRET_32 + "4");
  vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "https://bitlab.example.com");
  vi.stubEnv("NEXT_PUBLIC_BITLAB_URL", "https://bitlab.example.com/");
  vi.stubEnv("NEXT_PUBLIC_BITQUEST_HOST", "bitquest.example.com");
}

// Reset tous les secrets via stubs vides. vitest + NODE_ENV=test par défaut.
function clearAll() {
  const keys = [
    "NODE_ENV",
    "DATABASE_URL",
    "REDIS_URL",
    "REDIS_REQUIRED",
    "CSRF_SECRET",
    "BITLAB_JWT_SECRET",
    "BITLAB_LAUNCH_SECRET",
    "BITLAB_SIGN_SECRET",
    "CERTIFICATE_SIGN_SECRET",
    "BITLAB_ALLOWED_ORIGINS",
    "NEXT_PUBLIC_BITLAB_URL",
    "NEXT_PUBLIC_BITQUEST_HOST",
  ];
  for (const k of keys) vi.stubEnv(k, "");
  vi.stubEnv("NODE_ENV", "development");
}

describe("env-validator", () => {
  describe("currentEnv", () => {
    it("dev par défaut si NODE_ENV absent ou dev", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(currentEnv()).toBe("development");
    });
    it("production reconnu", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(currentEnv()).toBe("production");
    });
    it("preprod/staging mappe sur preprod", () => {
      vi.stubEnv("NODE_ENV", "preprod");
      expect(currentEnv()).toBe("preprod");
      vi.stubEnv("NODE_ENV", "staging");
      expect(currentEnv()).toBe("preprod");
    });
  });

  describe("validateEnv", () => {
    it("dev sans config : aucune erreur critique", () => {
      clearAll();
      const issues = validateEnv();
      expect(issues.filter((i) => i.severity === "critical")).toEqual([]);
    });

    it("production valide : zéro issue", () => {
      clearAll();
      setupProdValid();
      expect(validateEnv()).toEqual([]);
    });

    it("production sans REDIS_URL → critical", () => {
      clearAll();
      setupProdValid();
      vi.stubEnv("REDIS_URL", "");
      const issues = validateEnv();
      const redis = issues.find((i) => i.key === "REDIS_URL" && i.severity === "critical");
      expect(redis).toBeDefined();
      expect(redis?.message).toMatch(/Variable obligatoire absente/);
    });

    it("production avec BITLAB_ALLOWED_ORIGINS=* → critical", () => {
      clearAll();
      setupProdValid();
      vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "*");
      const issues = validateEnv();
      const cors = issues.find((i) => i.key === "BITLAB_ALLOWED_ORIGINS");
      expect(cors?.severity).toBe("critical");
      expect(cors?.message).toMatch(/Wildcard.*interdit/);
    });

    it("production avec origin localhost → critical", () => {
      clearAll();
      setupProdValid();
      vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "http://localhost:3001");
      const issues = validateEnv();
      const cors = issues.find((i) => i.key === "BITLAB_ALLOWED_ORIGINS");
      expect(cors?.severity).toBe("critical");
      expect(cors?.message).toMatch(/localhost.*interdit/);
    });

    it("origin malformée → critical", () => {
      clearAll();
      setupProdValid();
      vi.stubEnv("BITLAB_ALLOWED_ORIGINS", "pas-une-url");
      const issues = validateEnv();
      expect(issues.some((i) => i.key === "BITLAB_ALLOWED_ORIGINS" && i.severity === "critical"))
        .toBe(true);
    });

    it("secret placeholder (change-me, your-X, dev-secret) → critical", () => {
      clearAll();
      setupProdValid();
      vi.stubEnv("CSRF_SECRET", "change-me-please");
      const issues = validateEnv();
      expect(issues.some((i) => i.key === "CSRF_SECRET" && /placeholder/i.test(i.message)))
        .toBe(true);
    });

    it("secret trop court → critical en prod", () => {
      clearAll();
      setupProdValid();
      vi.stubEnv("CSRF_SECRET", "short");
      const issues = validateEnv();
      expect(issues.some((i) => i.key === "CSRF_SECRET" && i.severity === "critical")).toBe(true);
    });

    it("secrets identiques → critical", () => {
      clearAll();
      setupProdValid();
      vi.stubEnv("BITLAB_JWT_SECRET", SECRET_32_B);
      vi.stubEnv("BITLAB_LAUNCH_SECRET", SECRET_32_B);
      const issues = validateEnv();
      expect(
        issues.some(
          (i) =>
            i.key.includes("BITLAB_JWT_SECRET") &&
            i.key.includes("BITLAB_LAUNCH_SECRET") &&
            /identiques/.test(i.message),
        ),
      ).toBe(true);
    });

    it("NEXT_PUBLIC_BITLAB_URL http:// en prod → critical", () => {
      clearAll();
      setupProdValid();
      vi.stubEnv("NEXT_PUBLIC_BITLAB_URL", "http://bitlab.example.com");
      const issues = validateEnv();
      expect(
        issues.some(
          (i) => i.key === "NEXT_PUBLIC_BITLAB_URL" && /non-https/i.test(i.message),
        ),
      ).toBe(true);
    });

    it("DATABASE_URL non-postgres → critical", () => {
      clearAll();
      setupProdValid();
      vi.stubEnv("DATABASE_URL", "mysql://wrong");
      const issues = validateEnv();
      expect(
        issues.some(
          (i) => i.key === "DATABASE_URL" && /postgresql/i.test(i.message),
        ),
      ).toBe(true);
    });

    it("REDIS_REQUIRED=0 en prod → critical", () => {
      clearAll();
      setupProdValid();
      vi.stubEnv("REDIS_REQUIRED", "0");
      const issues = validateEnv();
      expect(
        issues.some((i) => i.key === "REDIS_REQUIRED" && i.severity === "critical"),
      ).toBe(true);
    });
  });

  describe("validateOrThrow", () => {
    it("dev + issues warning : ne throw pas", () => {
      clearAll();
      vi.stubEnv("NODE_ENV", "development");
      expect(() => validateOrThrow()).not.toThrow();
    });

    it("prod + critical : throw", () => {
      clearAll();
      vi.stubEnv("NODE_ENV", "production");
      // Aucune variable prod → beaucoup de critiques.
      expect(() => validateOrThrow()).toThrow(/invalide/);
    });

    it("prod sans issues : ne throw pas", () => {
      clearAll();
      setupProdValid();
      expect(() => validateOrThrow()).not.toThrow();
    });
  });
});
