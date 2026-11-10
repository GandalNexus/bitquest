"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { readCookie } from "@/lib/bitquest/client";

/**
 * Bouton de hard-delete pour les comptes soft-deleted. Visible uniquement
 * sur les lignes où `isDeleted=true` (sinon l'admin doit demander au user
 * de supprimer son compte d'abord).
 */
export function PurgeButton({ userId, pseudo }: { userId: string; pseudo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onPurge = async () => {
    if (
      !confirm(
        `Purger définitivement ${pseudo} ?\n\nToutes les données associées (quêtes, badges, transactions, audit logs posés par ce user) seront supprimées. Irréversible.`,
      )
    ) {
      return;
    }
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/users/${userId}/purge`, {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPurge}
        disabled={pending}
        aria-label={`Purger ${pseudo}`}
        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-60"
      >
        <Trash2 className="h-3 w-3" aria-hidden />
        Purger
      </button>
      {error && (
        <span role="alert" className="text-[10px] text-destructive" title={error}>
          !
        </span>
      )}
    </div>
  );
}
