import { describe, it, expect } from "vitest";
import {
  STATUS_PRIORITY,
  TRACK_ORDER,
  pickNextQuest,
  isNewUser,
  eventText,
  relativeTime,
} from "./dashboard.utils";
import type { MeEvent, QuestState } from "@/lib/bitquest/client";

/* ------------------------------------------------------------------ */
/* Helpers de construction de QuestState                              */
/* ------------------------------------------------------------------ */

function makeQuest(overrides: Partial<QuestState> = {}): QuestState {
  return {
    id: "q_" + Math.random().toString(36).slice(2, 9),
    code: "genesis",
    track: "INITIATION",
    order: 1,
    title: "Le Bloc Genèse",
    subtitle: "",
    description: "",
    requiredLevel: 1,
    xpReward: 115,
    satsReward: 1000,
    missionType: "block_explorer",
    totalSections: 3,
    totalQuiz: 4,
    status: "AVAILABLE",
    sectionsRead: 0,
    quizBestScore: 0,
    perfectQuiz: false,
    completedAt: null,
    locked: false,
    lockReason: null,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

describe("dashboard.utils — constantes", () => {
  it("expose les 4 pistes dans l'ordre d'affichage", () => {
    expect(TRACK_ORDER).toEqual(["INITIATION", "INTERMEDIATE", "ADVANCED", "SPECIAL"]);
  });

  it("STATUS_PRIORITY favorise IN_PROGRESS puis THEORY_DONE, puis QUIZ_PASSED, puis AVAILABLE", () => {
    expect(STATUS_PRIORITY.indexOf("IN_PROGRESS")).toBeLessThan(STATUS_PRIORITY.indexOf("AVAILABLE"));
    expect(STATUS_PRIORITY.indexOf("THEORY_DONE")).toBeLessThan(STATUS_PRIORITY.indexOf("AVAILABLE"));
    expect(STATUS_PRIORITY.indexOf("QUIZ_PASSED")).toBeLessThan(STATUS_PRIORITY.indexOf("AVAILABLE"));
  });
});

/* ------------------------------------------------------------------ */
/* pickNextQuest                                                       */
/* ------------------------------------------------------------------ */

describe("pickNextQuest", () => {
  it("retourne undefined si aucune quête fournie", () => {
    expect(pickNextQuest([])).toBeUndefined();
  });

  it("retourne undefined si toutes les quêtes sont COMPLETED", () => {
    const quests = [
      makeQuest({ code: "a", order: 1, status: "COMPLETED" }),
      makeQuest({ code: "b", order: 2, status: "COMPLETED" }),
    ];
    expect(pickNextQuest(quests)).toBeUndefined();
  });

  it("retourne undefined si toutes les quêtes restantes sont verrouillées", () => {
    const quests = [
      makeQuest({ code: "a", order: 1, locked: true }),
      makeQuest({ code: "b", order: 2, locked: true }),
    ];
    expect(pickNextQuest(quests)).toBeUndefined();
  });

  it("choisit la quête d'ordre le plus bas parmi les candidates", () => {
    const quests = [
      makeQuest({ code: "b", order: 2, status: "AVAILABLE" }),
      makeQuest({ code: "a", order: 1, status: "AVAILABLE" }),
      makeQuest({ code: "c", order: 3, status: "AVAILABLE" }),
    ];
    expect(pickNextQuest(quests)?.code).toBe("a");
  });

  it("à ordre égal, préfère une quête IN_PROGRESS à une AVAILABLE", () => {
    const quests = [
      makeQuest({ code: "a", order: 1, status: "AVAILABLE" }),
      makeQuest({ code: "a-bis", order: 1, status: "IN_PROGRESS" }),
    ];
    expect(pickNextQuest(quests)?.code).toBe("a-bis");
  });

  it("ignore une quête COMPLETED même si locked=false et order=1", () => {
    const quests = [
      makeQuest({ code: "a", order: 1, status: "COMPLETED" }),
      makeQuest({ code: "b", order: 2, status: "AVAILABLE" }),
    ];
    expect(pickNextQuest(quests)?.code).toBe("b");
  });

  it("ignore une quête verrouillée même si elle est AVAILABLE côté status", () => {
    const quests = [
      makeQuest({ code: "a", order: 1, locked: true, status: "AVAILABLE" }),
      makeQuest({ code: "b", order: 2, locked: false, status: "AVAILABLE" }),
    ];
    expect(pickNextQuest(quests)?.code).toBe("b");
  });
});

/* ------------------------------------------------------------------ */
/* isNewUser                                                           */
/* ------------------------------------------------------------------ */

describe("isNewUser", () => {
  it("vrai pour un compte sans XP, sans événement, sans quête terminée", () => {
    expect(isNewUser({ completedCount: 0, eventCount: 0, xp: 0 })).toBe(true);
  });

  it("faux dès qu'une seule quête est terminée", () => {
    expect(isNewUser({ completedCount: 1, eventCount: 0, xp: 0 })).toBe(false);
  });

  it("faux si des événements existent (lecture de section comptée)", () => {
    expect(isNewUser({ completedCount: 0, eventCount: 1, xp: 0 })).toBe(false);
  });

  it("faux dès qu'un peu d'XP est gagné (lecture de section)", () => {
    expect(isNewUser({ completedCount: 0, eventCount: 0, xp: 5 })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* eventText                                                           */
/* ------------------------------------------------------------------ */

function makeEvent(type: string, payload: Record<string, unknown> = {}): MeEvent {
  return { type, payload, createdAt: new Date().toISOString() };
}

describe("eventText", () => {
  it("QUEST_COMPLETED formate avec le titre de la quête", () => {
    expect(eventText(makeEvent("QUEST_COMPLETED", { questTitle: "Le Bloc Genèse" }))).toBe(
      "Quête terminée : Le Bloc Genèse",
    );
  });

  it("QUEST_COMPLETED fallback quand le titre manque", () => {
    expect(eventText(makeEvent("QUEST_COMPLETED", {}))).toBe("Quête terminée : une quête");
  });

  it("BADGE_UNLOCKED formate avec le nom du badge", () => {
    expect(eventText(makeEvent("BADGE_UNLOCKED", { badgeName: "UTXO Master" }))).toBe(
      "Badge débloqué : UTXO Master",
    );
  });

  it("LEVEL_UP affiche le niveau atteint", () => {
    expect(eventText(makeEvent("LEVEL_UP", { to: 3 }))).toBe("Niveau 3 atteint");
  });

  it("LEVEL_UP fallback si le niveau est invalide", () => {
    expect(eventText(makeEvent("LEVEL_UP", { to: "x" }))).toBe("Niveau supérieur atteint");
  });

  it("SATS_EARNED affiche le montant avec séparateur FR", () => {
    expect(eventText(makeEvent("SATS_EARNED", { amount: 1250 }))).toContain("1");
    expect(eventText(makeEvent("SATS_EARNED", { amount: 1250 }))).toContain("sats");
  });

  it("type inconnu → message générique", () => {
    expect(eventText(makeEvent("WEIRD_EVENT"))).toBe("Événement d'aventure");
  });
});

/* ------------------------------------------------------------------ */
/* relativeTime                                                        */
/* ------------------------------------------------------------------ */

describe("relativeTime", () => {
  it("'—' quand l'ISO est invalide", () => {
    expect(relativeTime("not-a-date")).toBe("—");
  });

  it("produit une chaîne non vide en français pour une date valide", () => {
    const now = new Date().toISOString();
    const result = relativeTime(now);
    expect(result).not.toBe("—");
    expect(result.length).toBeGreaterThan(0);
  });
});
