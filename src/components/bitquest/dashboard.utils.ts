/**
 * Fonctions utilitaires pures du Dashboard — extraites pour pouvoir être
 * testées unitairement sans monter de composant React.
 *
 * Ne pas y mettre de logique qui dépend de hooks React, de window ou
 * du store Zustand : garde uniquement des fonctions pures.
 */

import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { MeEvent, QuestState } from "@/lib/bitquest/client";
import { formatSats } from "@/lib/bitquest/client";

/** Ordre de priorité quand plusieurs quêtes débloquées existent à la même position. */
export const STATUS_PRIORITY = ["IN_PROGRESS", "THEORY_DONE", "QUIZ_PASSED", "AVAILABLE"];

/** Pistes de quêtes dans l'ordre d'affichage. */
export const TRACK_ORDER = ["INITIATION", "INTERMEDIATE", "ADVANCED", "SPECIAL"] as const;
export type TrackCode = (typeof TRACK_ORDER)[number];

/**
 * Sélectionne la prochaine quête à proposer à l'apprenant.
 * Règles :
 *  1. Ignorer les quêtes terminées et verrouillées.
 *  2. Trier par `order` croissant (progression linéaire).
 *  3. À `order` égal, préférer les quêtes commencées (IN_PROGRESS) aux disponibles.
 */
export function pickNextQuest(quests: QuestState[]): QuestState | undefined {
  const candidates = quests
    .filter((q) => q.status !== "COMPLETED" && !q.locked)
    .sort(
      (a, b) =>
        a.order - b.order ||
        STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status),
    );
  return candidates[0];
}

/**
 * Détermine si un utilisateur est "tout neuf" (zéro progression, zéro événement).
 * Utilisé pour afficher l'onboarding dans le Dashboard.
 */
export function isNewUser(args: {
  completedCount: number;
  eventCount: number;
  xp: number;
}): boolean {
  return args.completedCount === 0 && args.eventCount === 0 && args.xp === 0;
}

/** Transforme un `MeEvent` en texte lisible pour le journal d'activité. */
export function eventText(e: MeEvent): string {
  const p = e.payload ?? {};
  switch (e.type) {
    case "QUEST_COMPLETED": {
      const title = typeof p.questTitle === "string" ? p.questTitle : "une quête";
      return `Quête terminée : ${title}`;
    }
    case "BADGE_UNLOCKED": {
      const name = typeof p.badgeName === "string" ? p.badgeName : "un badge";
      return `Badge débloqué : ${name}`;
    }
    case "LEVEL_UP": {
      const to = Number(p.to);
      return Number.isFinite(to) ? `Niveau ${to} atteint` : "Niveau supérieur atteint";
    }
    case "SATS_EARNED": {
      const amount = Number(p.amount);
      return Number.isFinite(amount) ? `+${formatSats(amount)} sats gagnés` : "Satoshis gagnés";
    }
    default:
      return "Événement d'aventure";
  }
}

/** Temps relatif en français (ex. "il y a 3 minutes"). "—" si invalide. */
export function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: fr });
  } catch {
    return "—";
  }
}
