import { Loader2 } from "lucide-react";

/**
 * Loading skeleton partagé pour toutes les routes du groupe (app).
 * Évite le flash blanc pendant la navigation client-side.
 */
export default function AppLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
      <span className="text-sm">Chargement…</span>
    </div>
  );
}
