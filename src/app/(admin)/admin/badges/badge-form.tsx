"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";
import { PendingButton } from "@/components/ui/pending-button";

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

const CONDITION_HINTS: Record<ConditionType, string> = {
  QUEST_COMPLETE: '{ "questCode": "genesis" }',
  QUEST_COUNT: '{ "count": 3 }',
  TRACK_COMPLETE: '{ "track": "INITIATION" }',
  STREAK: '{ "days": 7 }',
  LEVEL: '{ "level": 3 }',
  SATS_TOTAL: '{ "sats": 10000 }',
  PERFECT_QUIZ: "{}",
};

interface BadgeInitial {
  id?: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  conditionType: ConditionType;
  conditionValue: Record<string, unknown>;
}

export function BadgeForm({
  initial,
  mode,
  earnedCount = 0,
}: {
  initial: BadgeInitial;
  mode: "create" | "edit";
  earnedCount?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<BadgeInitial>(initial);
  const [conditionText, setConditionText] = useState(() =>
    JSON.stringify(initial.conditionValue, null, 2),
  );

  const conditionError = useMemo<string | null>(() => {
    if (conditionText.trim().length === 0) return null;
    try {
      const parsed = JSON.parse(conditionText);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return "Le JSON doit être un objet { ... }.";
      }
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "JSON invalide.";
    }
  }, [conditionText]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (conditionError) {
      setError("Corrige le JSON de la condition avant d'enregistrer.");
      return;
    }
    const conditionValue = conditionText.trim()
      ? (JSON.parse(conditionText) as Record<string, unknown>)
      : {};
    const csrf = readCookie("bq_csrf");
    const url = mode === "create" ? "/api/admin/badges" : `/api/admin/badges/${initial.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const body =
      mode === "create"
        ? {
            code: state.code,
            name: state.name,
            description: state.description,
            icon: state.icon,
            rarity: state.rarity,
            conditionType: state.conditionType,
            conditionValue,
          }
        : {
            name: state.name,
            description: state.description,
            icon: state.icon,
            rarity: state.rarity,
            conditionType: state.conditionType,
            conditionValue,
          };
    try {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      setSaved(true);
      startTransition(() => {
        if (mode === "create") router.push("/admin/badges");
        else router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  const onDelete = async (force: boolean) => {
    if (!initial.id) return;
    if (!force) {
      if (!confirm("Supprimer ce badge ?")) return;
    }
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/badges/${initial.id}${force ? "?force=true" : ""}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && !force) {
        const msg = (data as { error?: string }).error ?? "Badge attribué à des utilisateurs.";
        if (confirm(`${msg}\n\nConfirmer la suppression en cascade (perte d'historique) ?`)) {
          return onDelete(true);
        }
        return;
      }
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      startTransition(() => router.push("/admin/badges"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  const insertSuggestion = () => setConditionText(CONDITION_HINTS[state.conditionType]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block font-medium">
            Code{" "}
            {mode === "edit" && (
              <span className="text-xs text-muted-foreground">(immuable)</span>
            )}
          </span>
          <input
            type="text"
            required
            readOnly={mode === "edit"}
            value={state.code}
            onChange={(e) => setState({ ...state, code: e.target.value })}
            placeholder="first-quest"
            className={
              mode === "edit"
                ? "mt-1 w-full cursor-not-allowed rounded-md border bg-muted px-2 py-1.5 text-sm text-muted-foreground"
                : "mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            }
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium">Rareté</span>
          <select
            value={state.rarity}
            onChange={(e) => setState({ ...state, rarity: e.target.value as Rarity })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="block font-medium">Nom</span>
        <input
          type="text"
          required
          value={state.name}
          onChange={(e) => setState({ ...state, name: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">Description</span>
        <textarea
          required
          rows={2}
          value={state.description}
          onChange={(e) => setState({ ...state, description: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">Icône (nom Lucide)</span>
        <input
          type="text"
          required
          value={state.icon}
          onChange={(e) => setState({ ...state, icon: e.target.value })}
          placeholder="Rocket"
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block font-medium">Type de condition</span>
          <select
            value={state.conditionType}
            onChange={(e) => setState({ ...state, conditionType: e.target.value as ConditionType })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            {CONDITION_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={insertSuggestion}
            className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Insérer un modèle JSON pour {state.conditionType}
          </button>
        </div>
      </div>

      <label className="block text-sm">
        <span className="block font-medium">Valeur de condition (JSON)</span>
        <textarea
          rows={5}
          value={conditionText}
          onChange={(e) => setConditionText(e.target.value)}
          spellCheck={false}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Format attendu : <code>{CONDITION_HINTS[state.conditionType]}</code>
        </span>
      </label>
      {conditionError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          JSON invalide : {conditionError}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          {mode === "create" ? "Badge créé." : "Modifications enregistrées."}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div>
          {mode === "edit" && (
            <PendingButton
              type="button"
              onClick={() => onDelete(false)}
              pending={pending}
              pendingLabel="Suppression…"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              Supprimer{earnedCount > 0 ? ` (${earnedCount} utilisateur${earnedCount > 1 ? "s" : ""})` : ""}
            </PendingButton>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a href="/admin/badges" className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            Annuler
          </a>
          <PendingButton
            type="submit"
            pending={pending}
            pendingLabel={mode === "create" ? "Création…" : "Enregistrement…"}
            disabled={conditionError !== null}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {mode === "create" ? "Créer le badge" : "Enregistrer"}
          </PendingButton>
        </div>
      </div>
    </form>
  );
}
