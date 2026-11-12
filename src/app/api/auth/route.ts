import { db } from "@/lib/db";
import { publicUser } from "@/lib/bitquest/progression";
import { buildSessionCookie, rateLimit } from "@/lib/bitquest/session";
import { buildCsrfCookie, computeCsrfToken } from "@/lib/auth/csrf";
import {
  buildVerificationUrl,
  generateVerificationToken,
  sendVerificationEmail,
} from "@/lib/auth/email-verification";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logger } from "@/lib/log";
import { authBodySchema, parseJsonBody } from "@/lib/validation/schemas";
import crypto from "crypto";

const log = logger("auth");

/** Réponse JSON + Set-Cookie session (HttpOnly) + Set-Cookie CSRF (readable). */
function jsonWithSession(payload: unknown, token: string): Response {
  const maxAge = 60 * 60 * 24 * 30; // 30 jours
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", buildSessionCookie(token, { maxAgeSeconds: maxAge }));
  headers.append("Set-Cookie", buildCsrfCookie(computeCsrfToken(token), { maxAgeSeconds: maxAge }));
  return new Response(JSON.stringify(payload), { status: 200, headers });
}

const GUEST_NAMES = [
  "Satoshi Jr",
  "BlockRunner",
  "SatHunter",
  "MemExplorer",
  "NodeRider",
  "HodlerX",
  "BitRookie",
  "ChainWalker",
];

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, authBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    if (body.action === "register") {
      const { email, pseudo, password } = body;
      const existingEmail = await db.user.findUnique({ where: { email } });
      if (existingEmail) {
        return Response.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
      }
      const existingPseudo = await db.user.findUnique({ where: { pseudo } });
      if (existingPseudo) {
        return Response.json({ error: "Ce pseudo est déjà pris." }, { status: 409 });
      }
      const verificationToken = generateVerificationToken();
      const user = await db.user.create({
        data: {
          email,
          pseudo,
          passwordHash: hashPassword(password),
          token: crypto.randomBytes(24).toString("hex"),
          verificationToken,
          lastActiveDate: new Date().toISOString().slice(0, 10),
        },
      });
      // Déclenche l'envoi (fire-and-forget pour ne pas bloquer la
      // réponse ; le mailer catch ses propres erreurs).
      void sendVerificationEmail({
        email: user.email!,
        pseudo: user.pseudo,
        token: verificationToken,
      });
      log.info(
        { userId: user.id, email: user.email, verificationUrl: buildVerificationUrl(verificationToken) },
        "registration: verification email queued",
      );
      return jsonWithSession({ user: publicUser(user), token: user.token }, user.token);
    }

    if (body.action === "login") {
      const { email, password } = body;
      const user = await db.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return Response.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
      }
      const token = crypto.randomBytes(24).toString("hex");
      await db.user.update({ where: { id: user.id }, data: { token } });
      return jsonWithSession({ user: publicUser(user), token }, token);
    }

    if (body.action === "guest") {
      if (!(await rateLimit("guest:" + (req.headers.get("x-forwarded-for") ?? "local"), 10, 60_000))) {
        return Response.json({ error: "Trop de tentatives, réessaie dans une minute." }, { status: 429 });
      }
      const base = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
      let pseudo = base + "-" + crypto.randomBytes(2).toString("hex");
      while (await db.user.findUnique({ where: { pseudo } })) {
        pseudo = base + "-" + crypto.randomBytes(2).toString("hex");
      }
      const user = await db.user.create({
        data: {
          pseudo,
          isGuest: true,
          token: crypto.randomBytes(24).toString("hex"),
          lastActiveDate: new Date().toISOString().slice(0, 10),
        },
      });
      return jsonWithSession({ user: publicUser(user), token: user.token }, user.token);
    }

    /* Branch impossible grâce à la discriminated union, mais TypeScript l'exige. */
    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    log.error({ err: e, action: body.action }, "auth handler failed");
    return Response.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
