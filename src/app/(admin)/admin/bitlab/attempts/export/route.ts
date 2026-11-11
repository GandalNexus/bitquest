import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/roles";

const OUTCOMES = new Set([
  "ACCEPTED",
  "REJECTED",
  "NOT_FOUND",
  "UNAVAILABLE",
  "INVALID_JWT",
  "MEMPOOL",
  "BAD_REQUEST",
  "RATE_LIMITED",
]);

/**
 * Échappe une valeur CSV selon RFC 4180 :
 *   - guillemets doublés si la valeur contient " , ou \n
 *   - le champ entier est entouré de guillemets dans ce cas
 */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/["\n\r,]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * GET /admin/bitlab/attempts/export?outcome=…&quest=…
 * Télécharge l'ensemble filtré (sans limite 100) en CSV UTF-8.
 */
export async function GET(req: Request) {
  const gate = await requireRole(req, "ADMIN");
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const outcomeRaw = url.searchParams.get("outcome")?.trim();
  const questRaw = url.searchParams.get("quest")?.trim();
  const outcome = outcomeRaw && OUTCOMES.has(outcomeRaw) ? outcomeRaw : null;
  const questCode = questRaw && /^[a-z0-9-]{1,80}$/i.test(questRaw) ? questRaw : null;

  const where = {
    ...(outcome ? { outcome } : {}),
    ...(questCode ? { questCode } : {}),
  };

  // Hard cap à 10 000 lignes pour éviter un export runaway.
  const rows = await db.bitLabProofAttempt.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, pseudo: true },
        })
      : [];
  const pseudoById = new Map(users.map((u) => [u.id, u.pseudo]));

  const header = [
    "id",
    "createdAt",
    "userId",
    "pseudo",
    "questCode",
    "kind",
    "network",
    "outcome",
    "latencyMs",
    "reasonMessage",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.id),
        csvCell(r.createdAt.toISOString()),
        csvCell(r.userId),
        csvCell(pseudoById.get(r.userId) ?? ""),
        csvCell(r.questCode),
        csvCell(r.kind),
        csvCell(r.network),
        csvCell(r.outcome),
        csvCell(r.latencyMs),
        csvCell(r.reasonMessage),
      ].join(","),
    );
  }
  // BOM UTF-8 pour aider Excel à reconnaître l'encodage.
  const body = "\uFEFF" + lines.join("\n") + "\n";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filenameParts = ["bitlab-attempts", stamp];
  if (outcome) filenameParts.push(outcome.toLowerCase());
  if (questCode) filenameParts.push(questCode);
  const filename = filenameParts.join("_") + ".csv";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
