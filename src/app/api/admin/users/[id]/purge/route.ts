import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { logger } from "@/lib/log";

const log = logger("admin-user-purge");

/**
 * POST /api/admin/users/[id]/purge — hard delete d'un compte soft-deleted.
 *
 * - Refuse si la row n'est pas d'abord soft-deleted (deletedAt null) : évite
 *   qu'un admin confond purge et delete, et préserve la trace soft-deleted
 *   dans les flows RGPD habituels.
 * - Refuse l'auto-purge (actor.id === target.id) : un admin ne peut pas se
 *   purger lui-même via cette route — passerait d'abord par /api/me/delete.
 * - Cascade inclut : UserQuestProgress, UserBadge, WalletTransaction,
 *   UserEvent, LessonProgress, DailyChallengeCompletion (via les onDelete:
 *   Cascade du schéma).
 * - AdminAuditLog pointant vers la target : actorId=Restrict dans le schéma
 *   mais la row cible est actorId d'audits précédents possibles — on nettoie
 *   explicitement les entries pointant sur la cible avant le delete pour
 *   éviter un conflit onDelete: Restrict.
 * - Audit USER_PURGE conservé (actor différent de target : pas de récursion).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;
  const actor = guard.user;

  const { id } = await params;
  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, pseudo: true, email: true, deletedAt: true },
  });
  if (!target) {
    return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  if (target.id === actor.id) {
    return Response.json(
      { error: "Utilise /api/me/delete pour supprimer ton propre compte." },
      { status: 400 },
    );
  }

  if (target.deletedAt === null) {
    return Response.json(
      {
        error:
          "L'utilisateur doit être soft-deleted avant d'être purgé. Demande-lui de supprimer son compte, puis purge.",
      },
      { status: 400 },
    );
  }

  // Nettoyage des AdminAuditLog qui pointent sur la cible (Restrict empêche
  // le hard delete sinon).
  const orphanAudit = await db.adminAuditLog.deleteMany({
    where: { actorId: target.id },
  });

  await db.user.delete({ where: { id: target.id } });

  await logAdminAction(actor.id, "USER_PURGE", `user:${target.id}`, {
    pseudo: target.pseudo,
    purgedAt: new Date().toISOString(),
    orphanedAuditLogsRemoved: orphanAudit.count,
  });

  log.info(
    { actorId: actor.id, targetId: target.id, orphanAudit: orphanAudit.count },
    "user hard-deleted",
  );

  return Response.json({ ok: true, orphanedAuditLogsRemoved: orphanAudit.count });
}
