"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useBitQuest } from "@/lib/bitquest/store";
import { useMe, useSessionHydration } from "@/lib/bitquest/hooks";
import { AppShell } from "@/components/bitquest/app-shell";
import { AuthScreen } from "@/components/bitquest/auth-screen";
import { Dashboard } from "@/components/bitquest/dashboard";
import { QuestMap } from "@/components/bitquest/quest-map";
import { QuestPlayer } from "@/components/bitquest/quest-player";
import { ProfileView } from "@/components/bitquest/profile-view";
import { WalletView } from "@/components/bitquest/wallet-view";
import { Leaderboard } from "@/components/bitquest/leaderboard";
import { LoadingState } from "@/components/bitquest/ui-bits";
import {
  buildBitlabSsoRedirectUrl,
  isSafeReturnTo,
} from "@/lib/auth/return-to";

/**
 * Lit le `returnTo` dans les query params si on est en retour d'un SSO
 * BitLab (/api/auth/bitlab-sso sans session). Isolé sous une Suspense
 * boundary car `useSearchParams()` l'impose en App Router.
 */
function ReturnToBridge() {
  const searchParams = useSearchParams();
  const sessionReady = useBitQuest((s) => s.sessionReady);
  const userId = useBitQuest((s) => s.userId);
  const returnTo = useMemo(() => {
    const raw = searchParams?.get("returnTo");
    return raw && isSafeReturnTo(raw) ? raw : null;
  }, [searchParams]);

  // Dès qu'une session est active, si on a un returnTo valide, on
  // renavigue vers le flow SSO. BitQuest re-détectera son cookie et
  // redirigera vers BitLab avec un launch_token frais.
  useEffect(() => {
    if (!sessionReady || !userId || !returnTo) return;
    if (typeof window === "undefined") return;
    window.location.replace(buildBitlabSsoRedirectUrl(returnTo));
  }, [sessionReady, userId, returnTo]);

  return null;
}

function BitQuestApp() {
  useSessionHydration();
  const sessionReady = useBitQuest((s) => s.sessionReady);
  const userId = useBitQuest((s) => s.userId);
  const view = useBitQuest((s) => s.view);
  const activeQuestCode = useBitQuest((s) => s.activeQuestCode);
  const openQuest = useBitQuest((s) => s.openQuest);
  const closeQuest = useBitQuest((s) => s.closeQuest);
  const setView = useBitQuest((s) => s.setView);

  const { data, isLoading, isError } = useMe();

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState label="Initialisation de BitQuest…" />
      </div>
    );
  }

  if (!userId) {
    return (
      <Suspense fallback={null}>
        <AuthScreen />
      </Suspense>
    );
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

  return (
    <AppShell>
      {activeQuestCode ? (
        <QuestPlayer
          key={activeQuestCode}
          code={activeQuestCode}
          onExit={closeQuest}
          onCompleted={closeQuest}
          onGoToDashboard={() => {
            setView("dashboard");
            closeQuest();
          }}
        />
      ) : (
        <>
          {view === "dashboard" && <Dashboard onOpenQuest={openQuest} onNavigate={setView} />}
          {view === "quests" && <QuestMap onOpenQuest={openQuest} />}
          {view === "profile" && <ProfileView />}
          {view === "wallet" && <WalletView />}
          {view === "leaderboard" && <Leaderboard />}
        </>
      )}
    </AppShell>
  );
}

export default function Page() {
  // ThemeProvider + QueryClientProvider sont désormais fournis par
  // `src/app/providers.tsx` (monté depuis layout.tsx). Les déplacer
  // hors de cette page client évite le warning React :
  //   « Encountered a script tag while rendering React component »
  // qu'émettait le script anti-FOUC de next-themes quand ThemeProvider
  // vivait sous un boundary `"use client"`.
  return (
    <>
      <Suspense fallback={null}>
        <ReturnToBridge />
      </Suspense>
      <BitQuestApp />
    </>
  );
}
