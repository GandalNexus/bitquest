import crypto from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/log";
import { sendMail } from "@/lib/mail/mailer";
import { verificationEmailTemplate } from "@/lib/mail/templates";

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
 * Envoie l'email de vérification avec le token déjà généré. Utilisé à
 * l'inscription (le token est écrit lors de la création du User, on
 * veut juste déclencher l'envoi). Retourne `dispatched` pour signaler
 * si un provider réel a traité le mail.
 */
export async function sendVerificationEmail(args: {
  email: string;
  pseudo: string;
  token: string;
}): Promise<{ url: string; dispatched: boolean }> {
  const url = buildVerificationUrl(args.token);
  const message = verificationEmailTemplate({
    to: args.email,
    pseudo: args.pseudo,
    url,
  });
  const result = await sendMail(message);
  const dispatched = result.ok && result.provider !== "none";
  log.info(
    { email: args.email, provider: result.provider, dispatched, resendId: result.id },
    dispatched ? "verification email dispatched (register)" : "verification email not dispatched",
  );
  return { url, dispatched };
}

/**
 * Émet un token de vérification pour un utilisateur enregistré et
 * déclenche l'envoi par email via le provider configuré. Idempotent :
 * écrase un token existant pour invalider les anciens liens.
 *
 * Retourne `{ url, dispatched }` :
 *   - `url` : URL de vérification (toujours retournée)
 *   - `dispatched` : true si le mailer a bien envoyé, false sinon
 *     (provider=none ou échec). Le caller peut l'utiliser pour afficher
 *     l'URL en dev quand aucun envoi réel n'a eu lieu.
 */
export async function issueEmailVerification(
  userId: string,
): Promise<{ url: string; dispatched: boolean }> {
  const token = generateVerificationToken();
  const user = await db.user.update({
    where: { id: userId },
    data: { verificationToken: token },
    select: { email: true, pseudo: true },
  });
  const url = buildVerificationUrl(token);

  if (!user.email) {
    log.warn({ userId }, "verification requested for user without email — URL only");
    return { url, dispatched: false };
  }

  const message = verificationEmailTemplate({
    to: user.email,
    pseudo: user.pseudo,
    url,
  });
  const result = await sendMail(message);
  const dispatched = result.ok && result.provider !== "none";

  log.info(
    {
      userId,
      email: user.email,
      provider: result.provider,
      dispatched,
      resendId: result.id,
    },
    dispatched ? "verification email dispatched" : "verification email not dispatched (provider=none or error)",
  );

  return { url, dispatched };
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
