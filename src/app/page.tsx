"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
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

  return (
    <AppShell>
      {activeQuestCode ? (
        <QuestPlayer
          key={activeQuestCode}
          code={activeQuestCode}
          onExit={closeQuest}
          onCompleted={closeQuest}
        />
      ) : (
        <>
          {view === "dashboard" && (
            <Dashboard onOpenQuest={openQuest} onNavigate={setView} />
          )}
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
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <BitQuestApp />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
