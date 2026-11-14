"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Search, X } from "lucide-react";

const RARITIES = ["COMMON", "RARE", "EPIC"] as const;

/**
 * Barre de filtres `/admin/badges` : recherche par nom/code (ILIKE) +
 * raccourci par rareté. Synchronise `q` et `rarity` dans l'URL.
 */
export function BadgesFilterBar({
  initialQuery,
  initialRarity,
}: {
  initialQuery: string;
  initialRarity: string | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  const applyParams = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v.length === 0) params.delete(k);
      else params.set(k, v);
    }
    startTransition(() => router.push(`/admin/badges?${params.toString()}`));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    applyParams({ q: q.trim() || null });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom ou code…"
            aria-label="Rechercher un badge"
            className="w-64 rounded-md border bg-background pl-8 pr-8 py-1.5 text-sm"
          />
          {q.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                applyParams({ q: null });
              }}
              aria-label="Effacer la recherche"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          Rechercher
        </button>
      </form>
      <div className="flex items-center gap-1" role="group" aria-label="Filtrer par rareté">
        <RarityChip
          active={initialRarity === null}
          label="Toutes"
          onClick={() => applyParams({ rarity: null })}
        />
        {RARITIES.map((r) => (
          <RarityChip
            key={r}
            active={initialRarity === r}
            label={r}
            onClick={() => applyParams({ rarity: r })}
          />
        ))}
      </div>
    </div>
  );
}

function RarityChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
