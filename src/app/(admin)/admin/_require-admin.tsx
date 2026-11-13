import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireRoleSsr } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";

/**
 * Guard SSR partagé pour les pages sous `/admin` strictement réservées
 * aux ADMIN (users, audit, badges, challenges, bitlab/attempts, health).
 *
 * Le layout `(admin)/admin/layout.tsx` accepte EDITOR+ — ces pages posent
 * un gate additionnel ici. En cas de rôle EDITOR, on affiche une erreur
 * contextualisée avec un retour vers `/studio`.
 */
export async function requireAdminOrDenied(): Promise<
  | { ok: true }
  | { ok: false; element: React.ReactElement }
> {
  const gate = await requireRoleSsr("ADMIN");
  if (gate.ok) return { ok: true };

  return {
    ok: false,
    element: (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md space-y-4 rounded-xl border bg-card p-8 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" aria-hidden />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold">Section ADMIN</h1>
          <p className="text-sm text-muted-foreground">
            Cette section est réservée aux administrateurs. En tant qu&apos;éditeur,
            tu peux gérer les cours, chapitres, leçons et quêtes depuis le Studio.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/">Retour à l&apos;app</Link>
            </Button>
            <Button asChild>
              <Link href="/studio">Ouvrir le Studio</Link>
            </Button>
          </div>
        </div>
      </div>
    ),
  };
}
