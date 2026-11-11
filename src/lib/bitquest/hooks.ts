"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, loadStoredSession, clearStoredSession } from "./client";
import { useBitQuest } from "./store";
import { useEffect } from "react";

export function useHasSession() {
  const userId = useBitQuest((s) => s.userId);
  const sessionReady = useBitQuest((s) => s.sessionReady);
  return sessionReady && !!userId;
}

/** Session expirée ou invalide (401) → nettoyage automatique. */
function useSessionGuard(hasError: boolean) {
  const logout = useBitQuest((s) => s.logout);
  useEffect(() => {
    if (hasError) {
      clearStoredSession();
      logout();
    }
  }, [hasError, logout]);
}

/** Profil + badges + events — synchronisé avec le store Zustand global. */
export function useMe() {
  const enabled = useHasSession();
  const setUser = useBitQuest((s) => s.setUser);
  const query = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled,
    retry: 1,
  });
  useSessionGuard(query.isError);
  useEffect(() => {
    if (query.data?.user) setUser(query.data.user);
  }, [query.data, setUser]);
  return query;
}

export function useQuests() {
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["quests"],
    queryFn: api.quests,
    enabled,
    retry: 1,
  });
}

export function useQuestDetail(code: string | null) {
  const enabled = useHasSession() && !!code;
  return useQuery({
    queryKey: ["quest", code],
    queryFn: () => api.quest(code as string),
    enabled,
    retry: 1,
  });
}

export function useWallet() {
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["wallet"],
    queryFn: api.wallet,
    enabled,
    retry: 1,
  });
}

/**
 * Stats d'activité BitLab de l'utilisateur courant (I4 — tuile
 * "Missions pratiques" du dashboard). Rafraîchi quand une preuve
 * vient d'être consommée via `useInvalidateAll`.
 */
export function useMyBitlabStats() {
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["me", "bitlab-stats"],
    queryFn: api.myBitlabStats,
    enabled,
    retry: 1,
  });
}

/**
 * Liste des tentatives BitLab de l'utilisateur (LOT 4). `state` filtre
 * sur les tentatives actives (reprise de mission) ou toutes (historique).
 * Variants cache-indépendants via inclusion de `state` + `limit` dans la clé.
 */
export function useMyBitlabAttempts(
  state: "active" | "all" = "all",
  limit = 20,
) {
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["me", "bitlab-attempts", state, limit],
    queryFn: () => api.myBitlabAttempts(state, limit),
    enabled,
    retry: 1,
  });
}

export function useLeaderboard() {
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: api.leaderboard,
    enabled,
    retry: 1,
  });
}

/** Invalide toutes les données dépendant de la progression (après XP/sats gagnés). */
export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["quests"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
    qc.invalidateQueries({ queryKey: ["me", "bitlab-stats"] });
  };
}

/** Hydrate la session depuis localStorage au démarrage. */
export function useSessionHydration() {
  const setSession = useBitQuest((s) => s.setSession);
  const markSessionReady = useBitQuest((s) => s.markSessionReady);
  useEffect(() => {
    const stored = loadStoredSession();
    if (stored) setSession(stored.userId, stored.token);
    markSessionReady();
  }, [setSession, markSessionReady]);
}
