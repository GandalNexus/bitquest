"use client";

import { type ReactNode } from "react";
import { useBitQuest } from "@/lib/bitquest/store";
import { useMe, useSessionHydration } from "@/lib/bitquest/hooks";
import { AppShell } from "./app-shell";
import { AuthScreen } from "./auth-screen";
import { LoadingState } from "./ui-bits";

/**
 * Wrapper partagé pour les pages de l'app connectée (hors / qui garde sa propre version SPA).
 * - Hydrate la session depuis localStorage.
 * - Affiche AuthScreen si pas de session.
 * - Charge le profil utilisateur (useMe).
 * - Enveloppe les pages dans AppShell (header, nav, footer).
 *
 * `ThemeProvider` et `QueryClientProvider` sont désormais fournis par
 * `src/app/providers.tsx` (monté dans le layout racine). Les isoler
 * là-haut évite le warning React « Encountered a script tag… » émis
 * par le `<script>` anti-FOUC de next-themes quand ThemeProvider vit
 * sous un boundary `"use client"`.
 */
function AppGate({ children }: { children: ReactNode }) {
  useSessionHydration();
  const sessionReady = useBitQuest((s) => s.sessionReady);
  const userId = useBitQuest((s) => s.userId);

  const { data, isLoading, isError } = useMe();

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState label="Initialisation de BitQuest…" />
      </div>
    );
  }

  if (!userId) {
    return <AuthScreen />;
  }

  if (isLoading && !data) {
    return (
      <AppShell>
        <LoadingState label="Chargement de ton profil d'aventurier…" />
      </AppShell>
    );
  }

  if (isError && !data) {
    return (
      <AppShell>
        <LoadingState label="Session expirée — recharge la page…" />
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}

export function AppLayoutClient({ children }: { children: ReactNode }) {
  return <AppGate>{children}</AppGate>;
}
