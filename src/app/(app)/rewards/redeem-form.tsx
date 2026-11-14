"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, XCircle, Zap } from "lucide-react";
import { readCookie } from "@/lib/bitquest/client";

type RedeemState =
  | { kind: "idle" }
  | { kind: "pending" }
  | {
      kind: "success";
      amountSats: number;
      feeSats: number | null;
      preimageHex: string | null;
    }
  | { kind: "error"; message: string };

const FAILURE_LABELS: Record<string, string> = {
  FLAG_DISABLED: "Programme non activé pour ton compte.",
  LND_UNCONFIGURED: "Le serveur n'a pas (encore) de node Lightning configuré.",
  LIVE_MODE_OFF: "Mode paiement live désactivé côté serveur (ops en dry-run).",
  INVOICE_INVALID: "Invoice BOLT11 illisible.",
  INVOICE_MAINNET: "Nous n'acceptons que les invoices testnet / signet / regtest.",
  INVOICE_NO_AMOUNT: "L'invoice doit avoir un montant explicite.",
  INVOICE_OVER_CAP: "Montant au-dessus du plafond autorisé.",
  INVOICE_OVER_DAILY_CAP: "Plafond quotidien dépassé — reviens demain.",
  INVOICE_OVER_WEEKLY_CAP: "Plafond hebdomadaire dépassé — reviens la semaine prochaine.",
  LND_NO_PREIMAGE: "LND n'a pas renvoyé de preimage — paiement non confirmé.",
};

function labelFailure(code: string | null): string {
  if (!code) return "Paiement échoué.";
  if (code.startsWith("LND_")) return `LND : ${code.slice(4)}`;
  return FAILURE_LABELS[code] ?? code;
}

export function RedeemForm() {
  const [invoice, setInvoice] = useState("");
  const [state, setState] = useState<RedeemState>({ kind: "idle" });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (invoice.trim().length < 50) {
      setState({ kind: "error", message: "Invoice trop courte." });
      return;
    }
    setState({ kind: "pending" });
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch("/api/me/lightning-reward", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ invoiceBolt11: invoice.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: "PAID" | "FAILED";
        amountMsat?: number;
        feeMsat?: number | null;
        preimageHex?: string | null;
        failureReason?: string | null;
        error?: string;
      };

      if (res.status === 403) {
        setState({ kind: "error", message: data.error ?? "Accès refusé." });
        return;
      }

      if (data.status === "PAID") {
        setState({
          kind: "success",
          amountSats: Math.floor((data.amountMsat ?? 0) / 1000),
          feeSats:
            typeof data.feeMsat === "number" ? Math.floor(data.feeMsat / 1000) : null,
          preimageHex: data.preimageHex ?? null,
        });
        setInvoice("");
      } else {
        setState({
          kind: "error",
          message: labelFailure(data.failureReason ?? null),
        });
      }
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur réseau inconnue.",
      });
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-describedby="redeem-help">
      <label className="block text-sm">
        <span className="block font-medium">Invoice Lightning (BOLT11)</span>
        <textarea
          rows={4}
          required
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
          placeholder="lntb1…"
          spellCheck={false}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
        />
        <span id="redeem-help" className="mt-1 block text-xs text-muted-foreground">
          Génère une invoice depuis ton wallet Lightning testnet (Phoenix, Blixt,
          BitLab…). Le montant est lu dans l&apos;invoice elle-même. Nous refusons
          mainnet et appliquons un plafond server-side.
        </span>
      </label>

      {state.kind === "success" && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <div className="font-medium">
              Paiement confirmé — {state.amountSats.toLocaleString("fr-FR")} sats
              {state.feeSats !== null && ` · frais : ${state.feeSats} sats`}
            </div>
            {state.preimageHex && (
              <code className="block truncate font-mono text-[11px] opacity-80">
                preimage : {state.preimageHex}
              </code>
            )}
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={state.kind === "pending"}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {state.kind === "pending" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Envoi en cours…
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" aria-hidden />
              Envoyer la récompense
            </>
          )}
        </button>
      </div>
    </form>
  );
}
