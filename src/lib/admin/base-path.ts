"use client";

import { usePathname } from "next/navigation";

/* ============================================================
 * Base path content admin — "/studio" (EDITOR) ou "/admin" (ADMIN).
 *
 * Les pages d'édition de contenu (cours, chapitres, leçons) sont
 * accessibles sous les deux préfixes :
 *   - /studio/* : portail EDITOR+
 *   - /admin/*  : console ADMIN (ADMIN voit tout)
 *
 * Les forms partagés (`course-form`, `chapter-form`, `lesson-form`)
 * doivent router leurs redirects (annulation, after-create, after-delete)
 * vers le **même préfixe** que celui d'où on vient, pour ne pas
 * ping-ponger l'utilisateur entre Studio et Admin.
 *
 * Ce helper résout le préfixe depuis `usePathname()` côté client.
 * Fallback : "/admin" (comportement historique avant Studio).
 * ============================================================ */

export type ContentBasePath = "/studio" | "/admin";

export function useContentBasePath(): ContentBasePath {
  const pathname = usePathname();
  if (pathname?.startsWith("/studio")) return "/studio";
  return "/admin";
}
