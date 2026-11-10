import crypto from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/log";

const log = logger("email-verification");

/* ============================================================
 * Email verification — foundation.
 *
 * Flow :
 *   1. Register génère un verificationToken (hex 32 B)
 *   2. L'URL de vérification est logguée côté serveur en dev (pas de
 *      SMTP wiring — un provider type Resend / SendGrid sera branché
 *      en prod)
 *   3. GET /api/auth/verify?token=xxx (ou POST avec body) valide :
 *      - supprime le token (one-shot)
 *      - met emailVerifiedAt = now
 * ============================================================ */

/** Génère un token de vérification cryptographiquement fort (32 bytes → 64 chars hex). */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * URL publique à envoyer par email. En dev : logguée dans la console
 * via le logger pino pour que l'apprenant la clique sans SMTP.
 */
export function buildVerificationUrl(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

/**
 * Émet un token de vérification pour un utilisateur enregistré et
 * retourne l'URL correspondante. Idempotent : écrase un token existant
 * pour éviter de laisser traîner d'anciens tokens valides.
 */
export async function issueEmailVerification(userId: string): Promise<{ url: string }> {
  const token = generateVerificationToken();
  const user = await db.user.update({
    where: { id: userId },
    data: { verificationToken: token },
    select: { email: true },
  });
  const url = buildVerificationUrl(token);
  log.info({ userId, email: user.email, url }, "verification email issued (console-only in dev)");
  return { url };
}

/**
 * Consomme un token de vérification et marque l'email vérifié.
 * Retourne l'userId vérifié, ou null si le token est invalide / déjà consommé.
 */
export async function consumeVerificationToken(token: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { verificationToken: token },
    select: { id: true, deletedAt: true },
  });
  if (!user || user.deletedAt !== null) return null;

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      verificationToken: null, // one-shot
    },
  });
  log.info({ userId: user.id }, "email verified");
  return user.id;
}
