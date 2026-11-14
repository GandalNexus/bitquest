import { redirect } from "next/navigation";
import { AlertTriangle, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRoleSsr } from "@/lib/auth/server";
import { isFeatureEnabled } from "@/lib/feature-flag";
import { db } from "@/lib/db";
import { RedeemForm } from "./redeem-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Récompenses Lightning — BitQuest",
};

/**
 * Page apprenant pour réclamer une récompense Lightning réelle (P4).
 *
 * Deux états :
 *   1. Flag OFF pour ce user → carte informative + waitlist.
 *   2. Flag ON → formulaire invoice + historique des 10 dernières demandes.
 *
 * ⚠️ Historique affiché ici ≠ wallet simulé (`/wallet`). Les deux rails
 * restent strictement séparés (manifesto § sim/réel).
 */
export default async function RewardsPage() {
  const auth = await requireRoleSsr("APPRENTICE");
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/");
    redirect("/dashboard");
  }

  const user = auth.user;
  const enabled = await isFeatureEnabled("lightning.rewards", user.id);

  const history = enabled
    ? await db.lightningReward.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          amountMsat: true,
          feeMsat: true,
          failureReason: true,
          createdAt: true,
          paidAt: true,
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <Zap className="h-7 w-7 text-primary" aria-hidden />
          Récompenses Lightning
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Convertis une partie de tes efforts BitQuest en sats <strong>réels</strong> sur
          un réseau Lightning. Ce flux est strictement isolé du wallet simulé
          du jeu — il y a toujours une invoice BOLT11 à fournir de ton côté.
        </p>
      </header>

      {!enabled ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              Programme pas encore ouvert pour ton compte
            </CardTitle>
            <CardDescription>
              La distribution Lightning réelle est activée par vagues restreintes.
              Continue tes quêtes ; le programme ouvre selon la gouvernance ops et
              les quotas testnet disponibles.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            En attendant, les sats affichés dans ton wallet BitQuest restent
            pédagogiques — ils comptent dans les classements et débloquent des
            niveaux, mais ne quittent pas le serveur de jeu.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Envoyer une récompense</CardTitle>
              <CardDescription>
                Ton paiement part depuis le node Lightning du serveur BitQuest
                vers l&apos;invoice que tu fournis. Pas d&apos;auto-complétion —
                le montant doit être explicite dans l&apos;invoice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RedeemForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique (10 dernières)</CardTitle>
              <CardDescription>
                Chaque tentative apparaît ici, même si elle a été refusée côté
                serveur (plafond, format, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Aucune tentative pour l&apos;instant.
                </p>
              ) : (
                <ul className="divide-y">
                  {history.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {Math.floor(r.amountMsat / 1000).toLocaleString("fr-FR")} sats
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.status === "PAID"
                            ? `Payé le ${r.paidAt?.toLocaleString("fr-FR") ?? "—"}`
                            : r.status === "FAILED"
                              ? `Refusé — ${r.failureReason ?? "raison inconnue"}`
                              : "En attente"}
                        </div>
                      </div>
                      <span
                        className={
                          r.status === "PAID"
                            ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500"
                            : r.status === "FAILED"
                              ? "rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive"
                              : "rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-500"
                        }
                      >
                        {r.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
