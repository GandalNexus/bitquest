"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";

/**
 * Combobox de recherche admin — remplace les <select> qui chargent tout en mémoire.
 *
 * Fetch lazy via `/api/admin/content/search` quand l'utilisateur tape (debounce 250ms).
 * Peut aussi fetcher au mount (loadOnOpen=true) pour afficher les premiers résultats.
 *
 * Contrat :
 *   - `type` : course | chapter | lesson | quest | challenge
 *   - `value` : l'ID actuellement sélectionné (ou slug/code — défini par l'intégration)
 *   - `onChange(item)` : item sélectionné (full object) OU null si "Effacer"
 *   - `valueField` : par défaut "id", peut être "slug" ou "code" pour piloter la clé retournée
 *   - `extraParams` : params additionnels à injecter dans l'URL (ex. courseSlug=xxx pour
 *     restreindre un chapter picker à un cours précis)
 *   - `displayItem` : (item) => node pour custom rendu d'une ligne
 *   - `selectedLabel` : label affiché quand la valeur est sélectionnée mais item non chargé
 *     (ex. après hydratation où on ne connaît que l'id). Optionnel.
 */

export interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  parentTitle?: string;
  meta?: string;
  status?: string;
  slug?: string;
  code?: string;
  parentSlug?: string;
}

interface Props {
  type: "course" | "chapter" | "lesson" | "quest" | "challenge";
  value: string | null;
  onChange: (item: SearchItem | null) => void;
  valueField?: "id" | "slug" | "code";
  placeholder?: string;
  extraParams?: Record<string, string | undefined>;
  selectedLabel?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

const DEBOUNCE_MS = 250;
const PAGE_SIZE = 10;

export function SearchableSelect({
  type,
  value,
  onChange,
  valueField = "id",
  placeholder = "Rechercher…",
  extraParams,
  selectedLabel,
  disabled,
  required,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  // Ferme au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Fetch avec debounce — relance dès que query/extraParams changent et popup ouverte.
  useEffect(() => {
    if (!open) return;
    const myId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      void fetchResults(query, myId);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, type, JSON.stringify(extraParams ?? {})]);

  // Si la value change de l'extérieur, essaie de la retrouver dans les items connus
  // pour maintenir l'affichage. Sinon bascule sur selectedLabel.
  useEffect(() => {
    if (value === null) {
      setSelectedItem(null);
      return;
    }
    const existing = items.find((it) => keyOf(it) === value);
    if (existing) setSelectedItem(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items, valueField]);

  const keyOf = (it: SearchItem): string => {
    if (valueField === "slug" && it.slug) return it.slug;
    if (valueField === "code" && it.code) return it.code;
    return it.id;
  };

  const fetchResults = async (q: string, myId: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type, limit: String(PAGE_SIZE) });
      if (q.trim().length > 0) params.set("q", q.trim());
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) {
          if (v) params.set(k, v);
        }
      }
      const res = await fetch(`/api/admin/content/search?${params.toString()}`, {
        credentials: "include",
      });
      if (myId !== requestIdRef.current) return; // stale response
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = (await res.json()) as { items: SearchItem[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      if (myId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : "Erreur de recherche.");
      setItems([]);
    } finally {
      if (myId === requestIdRef.current) setLoading(false);
    }
  };

  const select = (item: SearchItem) => {
    setSelectedItem(item);
    onChange(item);
    setOpen(false);
    setQuery("");
  };

  const clear = () => {
    setSelectedItem(null);
    onChange(null);
    setQuery("");
  };

  const displayText = selectedItem
    ? selectedItem.title
    : selectedLabel && value
      ? selectedLabel
      : "";

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required}
        className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 flex-1 truncate">
          {displayText || <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        {selectedItem && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            aria-label="Effacer la sélection"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {/* Popup */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-lg">
          <div className="border-b p-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-sm border bg-background py-1 pl-7 pr-2 text-sm"
              />
            </div>
          </div>
          <ul
            role="listbox"
            className="max-h-72 overflow-y-auto"
          >
            {loading && (
              <li className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Chargement…
              </li>
            )}
            {!loading && error && (
              <li className="px-3 py-2 text-xs text-destructive">{error}</li>
            )}
            {!loading && !error && items.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                {query ? `Aucun résultat pour « ${query} ».` : "Aucun contenu — commence à taper."}
              </li>
            )}
            {!loading &&
              !error &&
              items.map((it) => {
                const key = keyOf(it);
                const isSelected = key === value;
                return (
                  <li key={it.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => select(it)}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                        isSelected ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate font-medium">{it.title}</span>
                          {it.status && (
                            <span
                              className={`rounded-full border px-1.5 py-0 text-[10px] ${
                                it.status === "PUBLISHED"
                                  ? "border-emerald-500/40 text-emerald-600"
                                  : "border-amber-500/40 text-amber-600"
                              }`}
                            >
                              {it.status === "PUBLISHED" ? "Publié" : "Brouillon"}
                            </span>
                          )}
                        </div>
                        {it.parentTitle && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            ↳ {it.parentTitle}
                          </div>
                        )}
                        {it.subtitle && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {it.subtitle}
                          </div>
                        )}
                        {it.meta && (
                          <div className="text-[10px] text-muted-foreground/70">{it.meta}</div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
          {!loading && total > items.length && (
            <div className="border-t px-3 py-1.5 text-center text-[10px] text-muted-foreground">
              {items.length} affiché·s sur {total} — affine ta recherche
            </div>
          )}
        </div>
      )}
    </div>
  );
}
