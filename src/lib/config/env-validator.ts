/**
 * Validateur d'environnement production.
 *
 * Exécute une série de checks sur `process.env` et renvoie la liste des
 * problèmes trouvés. Jamais de valeur secrète dans les retours — seulement
 * présence, longueur, format.
 *
 * Deux modes :
 *   - `development` : les erreurs sont loggées mais n'empêchent pas le boot.
 *   - `production`  : les erreurs critiques sont retournées pour que l'appelant
 *     puisse faire crash le process au boot (`validateOrThrow()`).
 *
 * Utilisation côté runtime : importé par `instrumentation.ts` ou tooling CI.
 * Utilisation CLI : `npm run validate:env`.
 */

export type Severity = "critical" | "warning" | "info";

export interface EnvIssue {
  key: string;
  severity: Severity;
  message: string;
}

const MIN_SECRET_LEN = 32;
const PLACEHOLDER_PATTERNS = [
  /^change-?me/i,
  /^placeholder/i,
  /^your-?/i,
  /^xxx/i,
  /^todo/i,
  /^example/i,
  /^dev-?secret/i,
  /^test-?secret/i,
];

function isPlaceholder(v: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(v));
}

interface Spec {
  key: string;
  requiredIn: Array<"production" | "preprod" | "always">;
  minLen?: number;
  format?: "url" | "postgres" | "redis" | "https" | "originList";
  secret?: boolean;
  description: string;
}

/** Spécifications des variables d'environnement. */
const SPECS: Spec[] = [
  {
    key: "DATABASE_URL",
    requiredIn: ["always"],
    format: "postgres",
    secret: true,
    description: "URL Postgres (prisma schema utilise postgresql)",
  },
  {
    key: "REDIS_URL",
    requiredIn: ["production", "preprod"],
    format: "redis",
    description: "URL Redis — obligatoire en prod pour anti-replay",
  },
  {
    key: "CSRF_SECRET",
    requiredIn: ["production", "preprod"],
    minLen: MIN_SECRET_LEN,
    secret: true,
    description: "Secret HMAC pour tokens CSRF double-submit",
  },
  {
    key: "BITLAB_JWT_SECRET",
    requiredIn: ["production", "preprod"],
    minLen: MIN_SECRET_LEN,
    secret: true,
    description: "Clé HS256 pour les JWT mission challenge",
  },
  {
    key: "BITLAB_LAUNCH_SECRET",
    requiredIn: ["production", "preprod"],
    minLen: MIN_SECRET_LEN,
    secret: true,
    description: "Clé HS256 pour les launch tokens SSO",
  },
  {
    key: "BITLAB_SIGN_SECRET",
    requiredIn: ["production", "preprod"],
    minLen: MIN_SECRET_LEN,
    secret: true,
    description: "Clé HMAC pour signer les deep-links BitLab (optionnel en dev)",
  },
  {
    key: "CERTIFICATE_SIGN_SECRET",
    requiredIn: ["production", "preprod"],
    minLen: MIN_SECRET_LEN,
    secret: true,
    description: "Clé HMAC pour signer les certificats v1",
  },
  {
    key: "BITLAB_ALLOWED_ORIGINS",
    requiredIn: ["production", "preprod"],
    format: "originList",
    description: "Liste d'origines autorisées (CSV). Wildcard `*` interdit en prod.",
  },
  {
    key: "NEXT_PUBLIC_BITLAB_URL",
    requiredIn: ["production", "preprod"],
    format: "https",
    description: "URL publique de l'app BitLab (https:// en prod)",
  },
  {
    key: "NEXT_PUBLIC_BITQUEST_HOST",
    requiredIn: ["production", "preprod"],
    description: "Hostname BitQuest (pour les claims issuer de certificat)",
  },
];

export function currentEnv(): "production" | "preprod" | "development" {
  const raw = process.env.NODE_ENV?.toLowerCase();
  if (raw === "production") return "production";
  if (raw === "preprod" || raw === "staging") return "preprod";
  return "development";
}

function specRequired(spec: Spec, env: "production" | "preprod" | "development"): boolean {
  if (env === "development") return false;
  if (spec.requiredIn.includes("always")) return true;
  return spec.requiredIn.includes(env);
}

function checkFormat(key: string, value: string, format: Spec["format"]): EnvIssue | null {
  if (!format) return null;
  switch (format) {
    case "url":
    case "https": {
      try {
        const u = new URL(value);
        if (format === "https" && currentEnv() === "production" && u.protocol !== "https:") {
          return {
            key,
            severity: "critical",
            message: "Protocole non-https en production (requis pour cookies SameSite=None).",
          };
        }
        return null;
      } catch {
        return { key, severity: "critical", message: "URL malformée." };
      }
    }
    case "postgres":
      return value.startsWith("postgresql://") || value.startsWith("postgres://")
        ? null
        : { key, severity: "critical", message: "Doit commencer par postgresql:// ou postgres://." };
    case "redis":
      return value.startsWith("redis://") || value.startsWith("rediss://")
        ? null
        : { key, severity: "critical", message: "Doit commencer par redis:// ou rediss://." };
    case "originList": {
      const items = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length === 0) {
        return { key, severity: "critical", message: "Liste d'origines vide." };
      }
      if (items.includes("*")) {
        return {
          key,
          severity: "critical",
          message: "Wildcard `*` interdit en production (risque CSRF / CORS permissif).",
        };
      }
      for (const origin of items) {
        try {
          const u = new URL(origin);
          if (currentEnv() === "production" && u.hostname === "localhost") {
            return {
              key,
              severity: "critical",
              message: "Origin localhost interdit en production.",
            };
          }
        } catch {
          return { key, severity: "critical", message: `Origin malformée : ${origin}` };
        }
      }
      return null;
    }
    default:
      return null;
  }
}

/** Retourne la liste exhaustive des issues. */
export function validateEnv(): EnvIssue[] {
  const env = currentEnv();
  const issues: EnvIssue[] = [];

  for (const spec of SPECS) {
    const raw = process.env[spec.key]?.trim();
    const present = raw !== undefined && raw.length > 0;

    if (!present) {
      if (specRequired(spec, env)) {
        issues.push({
          key: spec.key,
          severity: "critical",
          message: `Variable obligatoire absente en ${env} : ${spec.description}`,
        });
      }
      continue;
    }

    if (spec.secret) {
      if (isPlaceholder(raw)) {
        issues.push({
          key: spec.key,
          severity: "critical",
          message: "Valeur ressemble à un placeholder (change-me, your-X, dev-secret…).",
        });
      }
      if (spec.minLen && raw.length < spec.minLen) {
        issues.push({
          key: spec.key,
          severity: env === "development" ? "warning" : "critical",
          message: `Longueur ${raw.length} caractères — minimum ${spec.minLen} recommandé.`,
        });
      }
    }

    const fmtIssue = checkFormat(spec.key, raw, spec.format);
    if (fmtIssue) issues.push(fmtIssue);
  }

  // Check additionnel : secrets uniques entre eux (pas de réutilisation).
  const secrets: Record<string, string | undefined> = {
    CSRF_SECRET: process.env.CSRF_SECRET,
    BITLAB_JWT_SECRET: process.env.BITLAB_JWT_SECRET,
    BITLAB_LAUNCH_SECRET: process.env.BITLAB_LAUNCH_SECRET,
    BITLAB_SIGN_SECRET: process.env.BITLAB_SIGN_SECRET,
    CERTIFICATE_SIGN_SECRET: process.env.CERTIFICATE_SIGN_SECRET,
  };
  const keys = Object.keys(secrets).filter((k) => secrets[k]);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (secrets[keys[i]] === secrets[keys[j]]) {
        issues.push({
          key: `${keys[i]} / ${keys[j]}`,
          severity: env === "development" ? "warning" : "critical",
          message: "Secrets identiques — chaque clé crypto doit avoir une valeur unique.",
        });
      }
    }
  }

  // Cohérence Redis strict :
  if (env === "production" && process.env.REDIS_REQUIRED === "0") {
    issues.push({
      key: "REDIS_REQUIRED",
      severity: "critical",
      message: "REDIS_REQUIRED=0 interdit en production (désactive l'anti-replay).",
    });
  }

  return issues;
}

/** Variante CLI/boot : log puis throw si critique en prod. */
export function validateOrThrow(logger?: {
  info(o: unknown, m?: string): void;
  warn(o: unknown, m?: string): void;
  error(o: unknown, m?: string): void;
}): void {
  const env = currentEnv();
  const issues = validateEnv();
  if (issues.length === 0) {
    logger?.info({ env }, "env validator : aucune anomalie détectée");
    return;
  }

  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");

  for (const i of warnings) {
    logger?.warn({ env, key: i.key }, `env validator WARN : ${i.message}`);
  }
  for (const i of critical) {
    logger?.error({ env, key: i.key }, `env validator CRITICAL : ${i.message}`);
  }

  if (env !== "development" && critical.length > 0) {
    throw new Error(
      `Configuration production invalide — ${critical.length} erreur(s) critique(s). Vérifie les logs pour les clés.`,
    );
  }
}
