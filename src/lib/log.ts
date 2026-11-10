import pino, { type Logger, type LoggerOptions } from "pino";
import { captureException } from "@/lib/obs/sentry";

/* ============================================================
 * Logger structuré — Phase 5.1b
 *
 * - Pretty en dev (pino-pretty), JSON compact en prod.
 * - Redaction des champs sensibles pour ne jamais exposer un token
 *   ou un mot de passe dans les logs applicatifs.
 * - `log.child({ scope: "foo" })` pour tagger les sous-systèmes.
 * ============================================================ */

/**
 * Chemins à masquer dans n'importe quel payload loggué.
 * Supporte les wildcards pino (`*.token`, `headers["x-csrf-token"]`, etc.).
 */
const REDACT_PATHS = [
  "token",
  "passwordHash",
  "password",
  "*.token",
  "*.passwordHash",
  "*.password",
  "headers.authorization",
  "headers.cookie",
  'headers["x-csrf-token"]',
  'headers["x-gn-token"]',
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-csrf-token"]',
  'req.headers["x-gn-token"]',
] as const;

const isProd = process.env.NODE_ENV === "production";

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  redact: {
    paths: [...REDACT_PATHS],
    censor: "[redacted]",
  },
  base: {
    service: "bitquest",
    env: process.env.NODE_ENV ?? "unknown",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

/**
 * Transport pretty en dev. On ne charge pino-pretty qu'en non-prod pour
 * éviter de le shiper dans le bundle de production.
 */
function makeLogger(): Logger {
  if (isProd) {
    return pino(baseOptions);
  }
  try {
    return pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "service,env,pid,hostname",
          messageFormat: "{scope} · {msg}",
        },
      },
    });
  } catch {
    // pino-pretty absent (build prod oublié ?) → fallback JSON brut
    return pino(baseOptions);
  }
}

/** Logger racine. Utiliser `log.child({ scope: "…" })` plutôt que ce singleton direct. */
export const log = makeLogger();

/**
 * Helper ergonomique pour créer un sous-logger avec un scope nommé.
 *
 * On wrap `.error()` pour relayer automatiquement vers Sentry (si DSN
 * configuré). Les callers ne font qu'un seul `log.error(...)` et la
 * bascule observabilité est transparente.
 */
export function logger(scope: string): Logger {
  const child = log.child({ scope });
  const originalError = child.error.bind(child);
  child.error = ((...args: Parameters<Logger["error"]>) => {
    try {
      const [first, msg] = args;
      if (first && typeof first === "object" && "err" in first) {
        const err = (first as { err: unknown }).err;
        if (err) captureException(err, { scope, msg, ...(first as Record<string, unknown>) });
      } else if (first instanceof Error) {
        captureException(first, { scope, msg });
      }
    } catch {
      /* Sentry no-op, swallow */
    }
    return originalError(...args);
  }) as Logger["error"];
  return child;
}
