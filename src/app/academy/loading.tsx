import { Loader2 } from "lucide-react";

export default function AcademyLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
      <span className="text-sm">Chargement de l&apos;Académie…</span>
    </div>
  );
}
