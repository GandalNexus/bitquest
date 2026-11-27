"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";
import { useContentBasePath } from "@/lib/admin/base-path";
import { PendingButton } from "@/components/ui/pending-button";
import { ImageField } from "@/components/admin/image-field";
import { PARTNER_TIERS, type PartnerTier } from "@/lib/validation/schemas";

interface PartnerInitial {
  id?: string;
  name: string;
  tier: PartnerTier;
  description: string;
  websiteUrl: string;
  logoUrl: string;
  initials: string;
  order: number;
  publishedAt: string | null;
}

const TIER_LABELS: Record<PartnerTier, string> = {
  SPONSOR: "Sponsor (financier)",
  PARTNER: "Partenaire (institutionnel/technique)",
  SUPPORTER: "Soutien (communautaire)",
};

export function PartnerForm({
  initial,
  mode,
}: {
  initial: PartnerInitial;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const basePath = useContentBasePath();
  const listUrl = `${basePath}/partners`;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<PartnerInitial>(initial);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const csrf = readCookie("bq_csrf");
    const url = mode === "create" ? "/api/admin/partners" : `/api/admin/partners/${initial.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const body = {
      name: state.name,
      tier: state.tier,
      description: state.description,
      websiteUrl: state.websiteUrl.trim().length > 0 ? state.websiteUrl.trim() : null,
      logoUrl: state.logoUrl.trim().length > 0 ? state.logoUrl.trim() : null,
      initials: state.initials,
      order: state.order,
      publishedAt: state.publishedAt,
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
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      }
      startTransition(() => {
        if (mode === "create") router.push(listUrl);
        else router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  const onDelete = async () => {
    if (!initial.id || !confirm("Supprimer définitivement ce partenaire ?")) return;
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/partners/${initial.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      startTransition(() => router.push(listUrl));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-6">
        <label className="block text-sm sm:col-span-3">
          <span className="block font-medium">
            Nom <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            required
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            placeholder="Bitcoin Beach Senegal"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-3">
          <span className="block font-medium">
            Catégorie <span className="text-destructive">*</span>
          </span>
          <select
            required
            value={state.tier}
            onChange={(e) => setState({ ...state, tier: e.target.value as PartnerTier })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {PARTNER_TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="block font-medium">
            Initiales <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            required
            maxLength={4}
            value={state.initials}
            onChange={(e) => setState({ ...state, initials: e.target.value })}
            placeholder="BB"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-center font-display text-sm uppercase"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="block font-medium">Ordre</span>
          <input
            type="number"
            min={0}
            value={state.order}
            onChange={(e) => setState({ ...state, order: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="block font-medium">
          Description courte <span className="text-destructive">*</span>
        </span>
        <textarea
          required
          rows={3}
          value={state.description}
          onChange={(e) => setState({ ...state, description: e.target.value })}
          placeholder="Partenaire infrastructure Lightning testnet — fournit un nœud LND public pour les quêtes BitQuest."
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          maxLength={500}
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">URL du site (optionnelle)</span>
        <input
          type="url"
          value={state.websiteUrl}
          onChange={(e) => setState({ ...state, websiteUrl: e.target.value })}
          placeholder="https://example.org"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>

      <ImageField
        label="Logo (optionnel)"
        hint="URL ou fichier. Vide = initiales en fallback."
        value={state.logoUrl}
        onChange={(next) => setState({ ...state, logoUrl: next })}
        initialsFallback={state.initials}
      />

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.publishedAt !== null}
          onChange={(e) =>
            setState({
              ...state,
              publishedAt: e.target.checked ? new Date().toISOString() : null,
            })
          }
        />
        <span>
          {state.publishedAt
            ? "Publié (visible sur la landing /gandalnexus)"
            : "Brouillon (caché)"}
        </span>
      </label>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div>
          {mode === "edit" && (
            <PendingButton
              type="button"
              onClick={onDelete}
              pending={pending}
              pendingLabel="Suppression…"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              Supprimer
            </PendingButton>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={listUrl}
            className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Annuler
          </a>
          <PendingButton
            type="submit"
            pending={pending}
            pendingLabel={mode === "create" ? "Création…" : "Enregistrement…"}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {mode === "create" ? "Créer le partenaire" : "Enregistrer"}
          </PendingButton>
        </div>
      </div>
    </form>
  );
}
