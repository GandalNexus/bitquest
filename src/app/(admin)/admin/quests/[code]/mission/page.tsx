import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MissionEditor } from "./mission-editor";

export const dynamic = "force-dynamic";

const MISSION_TYPES = [
  "block_explorer",
  "key_forge",
  "tx_builder",
  "mine_nonce",
  "ln_channel",
  "ln_invoice",
  "multisig_sign",
  "taproot_tweak",
] as const;
type MissionType = (typeof MISSION_TYPES)[number];

function isMissionType(value: string): value is MissionType {
  return (MISSION_TYPES as readonly string[]).includes(value);
}

/**
 * Déconstruit missionConfig stocké en DB en {brief, hint, config}.
 * `brief` et `hint` sont des clés réservées ; le reste va dans `config`.
 */
function splitMissionConfig(raw: string): {
  brief: string;
  hint: string;
  config: Record<string, unknown>;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { brief: "", hint: "", config: {} };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { brief: "", hint: "", config: {} };
  }
  const obj = parsed as Record<string, unknown>;
  const { brief, hint, ...rest } = obj;
  return {
    brief: typeof brief === "string" ? brief : "",
    hint: typeof hint === "string" ? hint : "",
    config: rest,
  };
}

export default async function EditQuestMissionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const quest = await db.quest.findUnique({ where: { code } });
  if (!quest) notFound();

  const { brief, hint, config } = splitMissionConfig(quest.missionConfig);
  const missionType: MissionType = isMissionType(quest.missionType)
    ? quest.missionType
    : "block_explorer";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/admin/quests/${code}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la fiche quête
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" aria-hidden />
            Mission — {quest.title}
          </CardTitle>
          <CardDescription>
            Type de mission + brief/hint affichés à l&apos;apprenant + config type-spécifique
            (JSON brut). Les 8 générateurs supportés sont définis dans{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              src/lib/bitquest/missions.ts
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MissionEditor code={quest.code} initial={{ missionType, brief, hint, config }} />
        </CardContent>
      </Card>
    </div>
  );
}
