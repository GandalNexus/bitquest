"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { QuestPlayer } from "@/components/bitquest/quest-player";

export default function QuestDeepLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  const backToMap = () => router.push("/quests");
  const goToDashboard = () => router.push("/dashboard");

  return (
    <QuestPlayer
      key={code}
      code={code}
      onExit={backToMap}
      onCompleted={backToMap}
      onGoToDashboard={goToDashboard}
    />
  );
}
