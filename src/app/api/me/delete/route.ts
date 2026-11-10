import crypto from "crypto";
import { db } from "@/lib/db";
import {
  authenticate,
  buildClearSessionCookie,
  rateLimit,
  unauthorized,
} from "@/lib/bitquest/session";
import { buildClearCsrfCookie, isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { deleteAccountSchema, parseJsonBody } from "@/lib/validation/schemas";
import { logger } from "@/lib/log";

const log = logger("account-delete");

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 32).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(check, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * POST /api/me/delete — soft-delete RGPD de l'utilisateur courant.
 *
 * Effets :
 *   - deletedAt = now (filtre partout dans l'app)
 *   - email = null (PII effacé)
 *   - pseudo = `deleted-<id8>` (préserve l'unicité sans exposer)
 *   - passwordHash = null (impossible de se reconnecter)
 *   - token rotaté (invalide toutes les sessions)
 *   - Clear-Cookie sur bq_session et bq_csrf
 *   - UserEvent ACCOUNT_DELETED (audit trail)
 *
 * On préserve xp / sats / streak / badges / progression : la row existe
 * toujours pour l'intégrité des références (badges d'autres users, audit
 * logs d'admin, etc.). Pour purger complètement, admin peut forcer un
 * hard-delete ultérieur.
 */
export async function POST(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`delete:${user.id}`, 3, 60_000))) {
    return Response.json({ error: "Trop de tentatives, patiente une minute." }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, deleteAccountSchema);
  if (!parsed.ok) return parsed.response;
  const { currentPassword } = parsed.data;

  // Pour les comptes enregistrés, vérifier le mot de passe actuel.
  if (!user.isGuest && user.passwordHash) {
    if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
      return Response.json({ error: "Mot de passe actuel incorrect." }, { status: 401 });
    }
  }

  // Un ADMIN ne peut pas s'auto-détruire (évite un lockout si c'est le dernier)
  if (user.role === "ADMIN") {
    const remainingAdmins = await db.user.count({
      where: { deletedAt: null, role: "ADMIN", id: { not: user.id } },
    });
    if (remainingAdmins === 0) {
      return Response.json(
        {
          error:
            "Tu es le dernier administrateur. Désigne un autre admin avant de supprimer ton compte.",
        },
        { status: 400 },
      );
    }
  }

  const idSuffix = user.id.slice(-8);
  await db.user.update({
    where: { id: user.id },
    data: {
      deletedAt: new Date(),
      email: null,
      pseudo: `deleted-${idSuffix}`,
      passwordHash: null,
      token: crypto.randomBytes(24).toString("hex"),
    },
  });

  await db.userEvent.create({
    data: {
      userId: user.id,
      type: "ACCOUNT_DELETED",
      payload: JSON.stringify({
        at: new Date().toISOString(),
        wasGuest: user.isGuest,
        previousRole: user.role,
      }),
    },
  });

  log.info({ userId: user.id, wasGuest: user.isGuest }, "account soft-deleted");

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", buildClearSessionCookie());
  headers.append("Set-Cookie", buildClearCsrfCookie());
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
