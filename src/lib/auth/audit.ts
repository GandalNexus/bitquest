import { db } from "@/lib/db";

/* ============================================================
 * Admin audit log — traces persistantes des mutations admin.
 *
 * Toute mutation réussie côté admin DOIT appeler logAdminAction()
 * avec son `action`, le `resource` (`type:id`) et un `meta` sérialisé
 * (changement, before/after si pertinent).
 *
 * Non-bloquant : les erreurs d'écriture sont silencieuses — ne pas
 * casser le flux utilisateur pour une trace manquante.
 * ============================================================ */

export type AuditAction =
  | "ROLE_CHANGE"
  | "COURSE_CREATE"
  | "COURSE_UPDATE"
  | "COURSE_DELETE"
  | "CHAPTER_CREATE"
  | "CHAPTER_UPDATE"
  | "CHAPTER_DELETE"
  | "LESSON_CREATE"
  | "LESSON_UPDATE"
  | "LESSON_DELETE"
  | "QUEST_UPDATE"
  | "QUEST_THEORY_UPDATE"
  | "QUEST_QUIZ_UPDATE";

export async function logAdminAction(
  actorId: string,
  action: AuditAction,
  resource: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        actorId,
        action,
        resource,
        meta: JSON.stringify(meta),
      },
    });
  } catch (err) {
    console.error("admin audit log failed", { action, resource, err });
  }
}
