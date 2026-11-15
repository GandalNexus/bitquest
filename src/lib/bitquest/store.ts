"use client";

import { create } from "zustand";
import type { PublicUser } from "./client";
import { clearStoredSession, storeSession } from "./client";

export type View =
  | "dashboard"
  | "quests"
  | "profile"
  | "wallet"
  | "leaderboard"
  | "attestations";

interface BitQuestStore {
  /* Session */
  userId: string | null;
  token: string | null;
  user: PublicUser | null;
  sessionReady: boolean; // hydratation localStorage terminée

  setSession: (userId: string, token: string) => void;
  setUser: (user: PublicUser | null) => void;
  logout: () => void;
  markSessionReady: () => void;

  /* Navigation SPA */
  view: View;
  activeQuestCode: string | null;
  setView: (view: View) => void;
  openQuest: (code: string) => void;
  closeQuest: () => void;

  /* Utilisateur sélectionné dans le joueur de quête */
  celebrate: number; // incrémenté pour déclencher une célébration globale
  triggerCelebrate: () => void;
}

export const useBitQuest = create<BitQuestStore>((set) => ({
  userId: null,
  token: null,
  user: null,
  sessionReady: false,

  setSession: (userId, token) => {
    storeSession(userId, token);
    set({ userId, token });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    clearStoredSession();
    set({ userId: null, token: null, user: null, view: "dashboard", activeQuestCode: null });
  },
  markSessionReady: () => set({ sessionReady: true }),

  view: "dashboard",
  activeQuestCode: null,
  setView: (view) => set({ view, activeQuestCode: null }),
  openQuest: (code) => set({ activeQuestCode: code }),
  closeQuest: () => set({ activeQuestCode: null }),

  celebrate: 0,
  triggerCelebrate: () => set((s) => ({ celebrate: s.celebrate + 1 })),
}));
