"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";
import { PendingButton } from "@/components/ui/pending-button";

interface LandingConfigInitial {
  bitquestUrl: string;
  bitlabUrl: string;
  landingUrl: string;
  githubOrgUrl: string;
  verifyUrl: string;
  contactEmail: string;
  twitterUrl: string;
  nostrPubkey: string;
  docsUrl: string;
}

const FIELDS: Array<{
  key: keyof LandingConfigInitial;
  label: string;
  hint: string;
  placeholder: string;
  type: "url" | "email" | "text";
  optional?: boolean;
}> = [
  {
    key: "bitquestUrl",
    label: "BitQuest",
    hint: "URL publique de l'app BitQuest (CTA « Learn »).",
    placeholder: "https://www.bitquest.gandalnexus.xyz",
    type: "url",
  },
  {
    key: "bitlabUrl",
    label: "BitLab",
    hint: "URL publique de l'app BitLab (CTA « Practice »).",
    placeholder: "https://www.bitlab.gandalnexus.xyz",
    type: "url",
  },
  {
    key: "landingUrl",
    label: "Landing (hub public)",
    hint: "URL de la landing GandalNexus — bouton « Nexus » dans BitQuest + BitLab.",
    placeholder: "https://www.gandalnexus.xyz",
    type: "url",
  },
  {
    key: "githubOrgUrl",
    label: "GitHub",
    hint: "URL de l'organisation GitHub (header + footer).",
    placeholder: "https://github.com/GandalNexus",
    type: "url",
  },
  {
    key: "verifyUrl",
    label: "Vérifier certificat",
    hint: "URL de vérification d'attestation (footer).",
    placeholder: "https://www.bitquest.gandalnexus.xyz/verify",
    type: "url",
  },
  {
    key: "contactEmail",
    label: "Email contact",
    hint: "mailto: affiché dans le footer. Laisser vide pour masquer.",
    placeholder: "hello@gandalnexus.xyz",
    type: "email",
    optional: true,
  },
  {
    key: "twitterUrl",
    label: "X / Twitter",
    hint: "Compte officiel. Laisser vide pour masquer l'icône du footer.",
    placeholder: "https://x.com/gandalnexus",
    type: "url",
    optional: true,
  },
  {
    key: "nostrPubkey",
    label: "Nostr pubkey",
    hint: "hex 64 chars ou npub1… bech32. Laisser vide pour masquer.",
    placeholder: "npub1… ou 64 chars hex",
    type: "text",
    optional: true,
  },
  {
    key: "docsUrl",
    label: "Documentation publique",
    hint: "Lien vers les docs (GitBook, readthedocs…). Vide = masqué.",
    placeholder: "https://docs.gandalnexus.xyz",
    type: "url",
    optional: true,
  },
];

export function LandingConfigForm({
  initial,
  updatedAt,
}: {
  initial: LandingConfigInitial;
  updatedAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(updatedAt);
  const [state, setState] = useState<LandingConfigInitial>(initial);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch("/api/admin/landing-config", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify(state),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        config?: LandingConfigInitial & { updatedAt: string };
        error?: string;
      };
      if (!res.ok || !data.ok || !data.config) {
        throw new Error(data.error ?? `Erreur ${res.status}`);
      }
      setState({
        bitquestUrl: data.config.bitquestUrl,
        bitlabUrl: data.config.bitlabUrl,
        landingUrl: data.config.landingUrl,
        githubOrgUrl: data.config.githubOrgUrl,
        verifyUrl: data.config.verifyUrl,
        contactEmail: data.config.contactEmail,
        twitterUrl: data.config.twitterUrl,
        nostrPubkey: data.config.nostrPubkey,
        docsUrl: data.config.docsUrl,
      });
      setSaved(data.config.updatedAt);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <label
            htmlFor={`landing-${f.key}`}
            className="flex items-baseline justify-between gap-3 text-sm font-medium"
          >
            <span className="flex items-center gap-1.5">
              {f.label}
              {f.optional && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                  optionnel
                </span>
              )}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {f.hint}
            </span>
          </label>
          <input
            id={`landing-${f.key}`}
            name={f.key}
            type={f.type === "text" ? "text" : f.type}
            inputMode={f.type === "email" ? "email" : f.type === "text" ? "text" : "url"}
            required={!f.optional}
            autoComplete="off"
            spellCheck={false}
            value={state[f.key]}
            placeholder={f.placeholder}
            onChange={(e) =>
              setState((s) => ({ ...s, [f.key]: e.target.value }))
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ))}

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          Dernière mise à jour :{" "}
          <time dateTime={saved ?? undefined}>
            {saved ? new Date(saved).toLocaleString("fr-FR") : "—"}
          </time>
        </p>
        <PendingButton type="submit" pending={pending}>
          Enregistrer
        </PendingButton>
      </div>
    </form>
  );
}
