import { db } from "@/lib/db";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { requireRole } from "@/lib/auth/roles";
import { logAdminAction } from "@/lib/auth/audit";
import { adminChangeRoleSchema, parseJsonBody } from "@/lib/validation/schemas";

/**
 * Change le rôle d'un utilisateur. Réservé aux ADMIN.
 *
 * - Si authentifié par cookie → CSRF enforcé.
 * - Un ADMIN ne peut PAS se retirer son propre rôle ADMIN (self-lockout
 *   prevention — la bascule doit passer par un autre admin ou par la DB).
 * - Rote le token de la cible pour invalider ses sessions en cours
 *   lorsqu'on change son rôle (effet d'application immédiat).
 * - Journalise l'action dans UserEvent (type ROLE_CHANGED).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(req, "ADMIN");
  if (!auth.ok) return auth.response;
  const actor = auth.user;

  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, actor.token);
    if (!csrf.ok) return csrf.response;
  }

  const parsed = await parseJsonBody(req, adminChangeRoleSchema);
  if (!parsed.ok) return parsed.response;
  const { role: newRole } = parsed.data;

  const { id: targetId } = await params;
  const target = await db.user.findUnique({ where: { id: targetId } });
  if (!target) {
    return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  // Protection : un admin ne peut pas se démoter lui-même.
  if (target.id === actor.id && newRole !== "ADMIN") {
    return Response.json(
      { error: "Impossible de retirer ton propre rôle ADMIN. Demande à un autre admin." },
      { status: 400 },
    );
  }

  if (target.role === newRole) {
    return Response.json({ ok: true, unchanged: true, user: publicUserLite(target) });
  }

  const previousRole = target.role;
  const updated = await db.user.update({
    where: { id: target.id },
    data: {
      role: newRole,
      // Rote le token de la cible : ses sessions existantes sont invalidées,
      // elle devra se reconnecter pour voir son nouveau rôle.
      token: await rotateToken(),
    },
  });

  await db.userEvent.create({
    data: {
      userId: actor.id,
      type: "ROLE_CHANGED",
      payload: JSON.stringify({
        targetUserId: target.id,
        targetPseudo: target.pseudo,
        previousRole,
        newRole,
      }),
    },
  });

  await logAdminAction(actor.id, "ROLE_CHANGE", `user:${target.id}`, {
    targetPseudo: target.pseudo,
    previousRole,
    newRole,
  });

  return Response.json({ ok: true, user: publicUserLite(updated) });
}

async function rotateToken(): Promise<string> {
  const { randomBytes } = await import("crypto");
  return randomBytes(24).toString("hex");
}

function publicUserLite(u: { id: string; pseudo: string; role: string }) {
  return { id: u.id, pseudo: u.pseudo, role: u.role };
}
