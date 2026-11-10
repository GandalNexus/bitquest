import crypto from "crypto";
import { db } from "@/lib/db";
import { authenticate, buildSessionCookie, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { buildCsrfCookie, computeCsrfToken, isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { changePasswordSchema, parseJsonBody } from "@/lib/validation/schemas";
import { logger } from "@/lib/log";

const log = logger("password");

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 32).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(check, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * POST /api/me/password — change le mot de passe d'un utilisateur enregistré.
 *
 * - Refuse les comptes invités (pas de passwordHash) ou les comptes sans
 *   email (pas de login classique).
 * - Vérifie le mot de passe actuel en temps constant (timingSafeEqual).
 * - Rote `User.token` : les sessions existantes (cookie + headers legacy)
 *   sont invalidées. On émet un nouveau Set-Cookie bq_session + bq_csrf
 *   pour que l'appelant reste connecté sans ré-auth.
 * - Journalise un UserEvent PASSWORD_CHANGED (pas le mot de passe, évidemment).
 */
export async function POST(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`password:${user.id}`, 5, 60_000))) {
    return Response.json({ error: "Trop de tentatives, patiente une minute." }, { status: 429 });
  }

  if (user.isGuest || !user.passwordHash) {
    return Response.json(
      { error: "Changer de mot de passe nécessite un compte enregistré (email + mot de passe)." },
      { status: 400 },
    );
  }

  const parsed = await parseJsonBody(req, changePasswordSchema);
  if (!parsed.ok) return parsed.response;
  const { currentPassword, newPassword } = parsed.data;

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return Response.json({ error: "Mot de passe actuel incorrect." }, { status: 401 });
  }

  if (currentPassword === newPassword) {
    return Response.json(
      { error: "Le nouveau mot de passe doit être différent de l'actuel." },
      { status: 400 },
    );
  }

  const newToken = crypto.randomBytes(24).toString("hex");
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(newPassword),
      token: newToken,
    },
  });

  await db.userEvent.create({
    data: {
      userId: user.id,
      type: "PASSWORD_CHANGED",
      payload: JSON.stringify({ at: new Date().toISOString() }),
    },
  });

  log.info({ userId: user.id }, "password changed");

  // Réémet les cookies avec le nouveau token pour que l'utilisateur reste logué.
  const maxAge = 60 * 60 * 24 * 30;
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", buildSessionCookie(newToken, { maxAgeSeconds: maxAge }));
  headers.append("Set-Cookie", buildCsrfCookie(computeCsrfToken(newToken), { maxAgeSeconds: maxAge }));
  return new Response(JSON.stringify({ ok: true, token: newToken }), { status: 200, headers });
}
