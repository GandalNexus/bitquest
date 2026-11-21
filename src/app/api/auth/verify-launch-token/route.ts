import { clientIp, rateLimit } from "@/lib/bitquest/session";
import {
  verifyLaunchTokenOrRespond,
  issueSessionToken,
  SESSION_TOKEN_TTL,
} from "@/lib/auth/launch-token";
import { parseJsonBody, verifyLaunchTokenSchema } from "@/lib/validation/schemas";
import { db } from "@/lib/db";
import { jsonWithProtocolVersion } from "@/lib/bitlab/response";

/**
 * POST /api/auth/verify-launch-token — vérifie un launch token émis par
 * BitQuest. Appelé depuis le serveur BitLab (CORS), jamais depuis le navigateur.
 *
 * Retourne le profil minimal de l'utilisateur après vérif JWT + nonce.
 * Public (pas d'auth BitQuest requise), mais rate-limité IP strict et
 * consommation du nonce (replay-safe).
 *
 * CORS : les origines autorisées sont lues depuis BITLAB_ALLOWED_ORIGINS
 * (liste séparée par virgules, défaut "*" permissif en dev).
 */

import { corsHeaders, preflight } from "@/lib/auth/cors";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const extraHeaders = corsHeaders(origin);
  // Rate-limit IP strict : la route est publique.
  if (!(await rateLimit(`verify-launch-ip:${clientIp(req)}`, 60, 60_000))) {
    return jsonWithProtocolVersion(
      { error: "Trop de requêtes depuis cette IP." },
      { status: 429, headers: extraHeaders },
    );
  }

  const parsed = await parseJsonBody(req, verifyLaunchTokenSchema);
  if (!parsed.ok) {
    // parseJsonBody renvoie déjà la Response — on la laisse telle quelle
    // mais on ajoute les headers CORS pour que BitLab puisse lire l'erreur.
    const body = await parsed.response.clone().json().catch(() => ({}));
    return jsonWithProtocolVersion(body, {
      status: parsed.response.status,
      headers: extraHeaders,
    });
  }
  const { token } = parsed.data;

  const chk = await verifyLaunchTokenOrRespond(token);
  if (!chk.ok) {
    const body = await chk.response.clone().json().catch(() => ({}));
    return jsonWithProtocolVersion(body, {
      status: chk.response.status,
      headers: extraHeaders,
    });
  }

  const { userId } = chk.claims;
  // Confirme que l'utilisateur existe toujours et n'est pas soft-deleted.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      pseudo: true,
      role: true,
      email: true,
      emailVerifiedAt: true,
      deletedAt: true,
      isGuest: true,
      isBot: true,
    },
  });
  if (!user || user.deletedAt !== null) {
    return jsonWithProtocolVersion(
      { error: "Utilisateur introuvable ou supprimé." },
      { status: 404, headers: extraHeaders },
    );
  }

  // Émet un session token longue durée (2h) pour que BitLab puisse
  // appeler les endpoints user-scoped read-only via Authorization: Bearer.
  const { token: sessionToken, expiresAt: sessionExpiresAt } = await issueSessionToken({
    userId: user.id,
    pseudo: user.pseudo,
    role: user.role,
  });

  return jsonWithProtocolVersion(
    {
      ok: true,
      user: {
        id: user.id,
        pseudo: user.pseudo,
        role: user.role,
        email: user.email,
        emailVerified: user.emailVerifiedAt !== null,
        isGuest: user.isGuest,
        isBot: user.isBot,
      },
      session: {
        token: sessionToken,
        expiresAt: sessionExpiresAt.toISOString(),
        ttlSeconds: SESSION_TOKEN_TTL,
      },
    },
    { headers: extraHeaders },
  );
}
