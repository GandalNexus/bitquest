import { authenticate, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { issueEmailVerification } from "@/lib/auth/email-verification";

/**
 * POST /api/auth/verification/send — (ré)émet un lien de vérification
 * pour l'utilisateur courant. Utile après register ou pour relancer.
 *
 * - Refuse les guests (pas d'email)
 * - Refuse les users déjà vérifiés (économise un roundtrip SMTP futur)
 * - Rate-limite 3/min par userId (évite le spam SMTP)
 */
export async function POST(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`verification-send:${user.id}`, 3, 60_000))) {
    return Response.json({ error: "Trop de demandes, patiente une minute." }, { status: 429 });
  }

  if (user.isGuest || !user.email) {
    return Response.json(
      { error: "Vérification d'email disponible uniquement pour les comptes enregistrés." },
      { status: 400 },
    );
  }
  if (user.emailVerifiedAt !== null) {
    return Response.json(
      { ok: true, alreadyVerified: true },
      { status: 200 },
    );
  }

  const { url } = await issueEmailVerification(user.id);
  // En prod : envoyer `url` par email via le provider. Dev : la URL est
  // visible dans les logs (voir issueEmailVerification).
  return Response.json({ ok: true, devUrl: process.env.NODE_ENV === "production" ? undefined : url });
}
