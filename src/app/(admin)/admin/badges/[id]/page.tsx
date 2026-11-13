import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeForm } from "../badge-form";
import { requireAdminOrDenied } from "../../_require-admin";

export const dynamic = "force-dynamic";

const RARITIES = ["COMMON", "RARE", "EPIC"] as const;
type Rarity = (typeof RARITIES)[number];

const CONDITION_TYPES = [
  "QUEST_COMPLETE",
  "QUEST_COUNT",
  "TRACK_COMPLETE",
  "STREAK",
  "LEVEL",
  "SATS_TOTAL",
  "PERFECT_QUIZ",
] as const;
type ConditionType = (typeof CONDITION_TYPES)[number];

function normalizeRarity(v: string): Rarity {
  return (RARITIES as readonly string[]).includes(v) ? (v as Rarity) : "COMMON";
}
function normalizeConditionType(v: string): ConditionType {
  return (CONDITION_TYPES as readonly string[]).includes(v) ? (v as ConditionType) : "QUEST_COMPLETE";
}

function parseConditionValue(raw: string): Record<string, unknown> {
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
  } catch {
    /* fallthrough */
  }
  return {};
}

export default async function EditBadgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const { id } = await params;
  const badge = await db.badge.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!badge) notFound();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/badges">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la liste
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Éditer : {badge.name}</CardTitle>
          <CardDescription>
            Attribué à {badge._count.users} utilisateur{badge._count.users > 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BadgeForm
            mode="edit"
            earnedCount={badge._count.users}
            initial={{
              id: badge.id,
              code: badge.code,
              name: badge.name,
              description: badge.description,
              icon: badge.icon,
              rarity: normalizeRarity(badge.rarity),
              conditionType: normalizeConditionType(badge.conditionType),
              conditionValue: parseConditionValue(badge.conditionValue),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
