"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";
import type { Role } from "@/lib/bitquest/client";

const ROLES: Role[] = ["APPRENTICE", "EDITOR", "ADMIN"];

/**
 * Formulaire inline de changement de rôle pour une ligne de la table users.
 * Désactivé pour l'utilisateur courant (prévention self-demote côté UI).
 */
export function RoleForm({
  userId,
  pseudo,
  currentRole,
  isSelf,
}: {
  userId: string;
  pseudo: string;
  currentRole: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const change = async (newRole: Role) => {
    if (newRole === currentRole) return;
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={`Rôle de ${pseudo}`}
        defaultValue={currentRole}
        disabled={isSelf || pending}
        onChange={(e) => change(e.target.value as Role)}
        className="rounded-md border bg-background px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {isSelf && (
        <span className="text-[10px] text-muted-foreground" title="Tu ne peux pas changer ton propre rôle ADMIN.">
          toi
        </span>
      )}
      {pending && <span className="text-[10px] text-muted-foreground">…</span>}
      {error && (
        <span role="alert" className="text-[10px] text-destructive" title={error}>
          !
        </span>
      )}
    </div>
  );
}
