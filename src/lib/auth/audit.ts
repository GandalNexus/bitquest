import { db } from "@/lib/db";
import { logger } from "@/lib/log";

const log = logger("admin-audit");

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
  | "QUEST_CREATE"
  | "QUEST_UPDATE"
  | "QUEST_DELETE"
  | "QUEST_THEORY_UPDATE"
  | "QUEST_QUIZ_UPDATE"
  | "QUEST_MISSION_UPDATE"
  | "BADGE_CREATE"
  | "BADGE_UPDATE"
  | "BADGE_DELETE"
  | "CHALLENGE_CREATE"
  | "CHALLENGE_UPDATE"
  | "CHALLENGE_DELETE"
  | "TEAM_MEMBER_CREATE"
  | "TEAM_MEMBER_UPDATE"
  | "TEAM_MEMBER_DELETE"
  | "PARTNER_CREATE"
  | "PARTNER_UPDATE"
  | "PARTNER_DELETE"
  | "LANDING_CONFIG_UPDATE"
  | "CHAPTER_QUEST_ATTACH"
  | "CHAPTER_QUEST_DETACH"
  | "FEATURE_FLAG_UPDATE"
  | "USER_PURGE"
  | "AI_DRAFT_GENERATE"
  | "AI_DRAFT_APPROVE"
  | "AI_DRAFT_REJECT"
  | "AI_CONFIG_UPDATE";

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
    log.error({ err, action, resource }, "admin audit log failed");
  }
}
