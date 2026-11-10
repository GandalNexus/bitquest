import { consumeVerificationToken } from "@/lib/auth/email-verification";
import { parseJsonBody, verifyEmailSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/bitquest/session";

/**
 * POST /api/auth/verify-email — consomme un token pour valider l'email.
 *
 * Rate-limité par IP (pas par user — l'utilisateur n'est pas encore
 * identifié). Toujours 200 en l'absence de match pour éviter d'énumérer
 * les tokens valides.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!(await rateLimit(`verify-email:${ip}`, 20, 60_000))) {
    return Response.json({ error: "Trop de tentatives, patiente une minute." }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, verifyEmailSchema);
  if (!parsed.ok) return parsed.response;

  const userId = await consumeVerificationToken(parsed.data.token);
  if (!userId) {
    // Réponse neutre : pas de distinction entre token inconnu et token déjà consommé
    // pour éviter l'énumération.
    return Response.json(
      { ok: false, reason: "Token invalide ou expiré." },
      { status: 400 },
    );
  }
  return Response.json({ ok: true });
}
