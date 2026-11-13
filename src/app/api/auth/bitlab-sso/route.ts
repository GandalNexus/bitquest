import { authenticate, clientIp, rateLimit } from "@/lib/bitquest/session";
import { issueLaunchToken } from "@/lib/auth/launch-token";
import { logger } from "@/lib/log";

const log = logger("bitlab-sso");

/**
 * GET /api/auth/bitlab-sso?returnTo=<url>
 *
 * Point d'entrée SSO top-level : BitLab y envoie l'utilisateur (navigation
 * normale, pas AJAX), BitQuest lit son cookie HttpOnly `bq_session`
 * (SameSite=Lax → envoyé lors d'une navigation top-level) et répond par
 * un redirect 302 :
 *
 *   - Utilisateur authentifié → `<returnTo>?launch_token=XXX`
 *     Le launch_token suit le même protocole que celui émis via
 *     `/api/auth/launch-token` (60s TTL, single-use, aud=bitlab-user).
 *     BitLab le consomme côté client via verifyLaunchTokenAgainstBitquest.
 *
 *   - Pas de session → redirect vers la home BitQuest avec `?returnTo=<url>`
 *     en query param. La page d'accueil (ou son hook d'onboarding) peut
 *     ré-émettre un SSO après login.
 *
 * Sécurité : `returnTo` est validé contre la liste `BITLAB_ALLOWED_ORIGINS`
 * (même allowlist que /api/auth/verify-launch-token pour les CORS). Si
 * l'origine n'est pas autorisée, on refuse le redirect pour empêcher
 * l'exfiltration du launch_token vers un domaine tiers.
 *
 * Rate-limit : par IP, 30/60s. La route est publique (pas d'auth requise
 * pour accéder — le succès dépend juste du cookie).
 */

function allowedOrigins(): string[] {
  const raw = process.env.BITLAB_ALLOWED_ORIGINS?.trim();
  if (!raw) return ["*"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * `returnTo` doit être une URL absolue http(s) dont l'origine est dans
 * l'allowlist. On rejette toute autre forme (schémas javascript:, data:,
 * chemins relatifs, URLs malformées).
 */
function validateReturnTo(raw: string | null): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const origins = allowedOrigins();
  if (origins.includes("*")) return url;
  const originStr = `${url.protocol}//${url.host}`;
  if (!origins.includes(originStr)) return null;
  return url;
}

export async function GET(req: Request) {
  if (!(await rateLimit(`bitlab-sso-ip:${clientIp(req)}`, 30, 60_000))) {
    return Response.json(
      { error: "Trop de requêtes depuis cette IP." },
      { status: 429 },
    );
  }

  const inputUrl = new URL(req.url);
  const returnToRaw = inputUrl.searchParams.get("returnTo");
  const returnTo = validateReturnTo(returnToRaw);

  if (!returnTo) {
    log.warn({ msg: "returnTo invalide ou hors allowlist", returnTo: returnToRaw });
    return Response.json(
      { error: "Paramètre returnTo invalide ou hors allowlist BitLab." },
      { status: 400 },
    );
  }

  const user = await authenticate(req);

  // Pas de session : redirige vers la home BitQuest en préservant returnTo.
  // La page BitQuest peut (à terme) proposer un flow "connecte-toi puis
  // reviens à BitLab" ; pour l'instant, c'est un simple rebond où l'user
  // devra cliquer à nouveau sur "Se connecter" après login.
  if (!user) {
    const fallback = new URL("/", inputUrl.origin);
    fallback.searchParams.set("returnTo", returnTo.toString());
    return Response.redirect(fallback.toString(), 302);
  }

  // Session valide : émet un launch_token et redirige vers BitLab en l'y
  // attachant en query param. BitLab consomme côté client via
  // verifyLaunchTokenAgainstBitquest → verify-launch-token (CORS).
  const { token } = await issueLaunchToken({
    userId: user.id,
    pseudo: user.pseudo,
    role: user.role,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
  });

  const target = new URL(returnTo.toString());
  target.searchParams.set("launch_token", token);

  log.info({
    msg: "SSO top-level vers BitLab",
    userId: user.id,
    origin: `${returnTo.protocol}//${returnTo.host}`,
  });

  return Response.redirect(target.toString(), 302);
}
