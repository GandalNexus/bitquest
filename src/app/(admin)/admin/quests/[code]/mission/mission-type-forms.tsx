"use client";

/**
 * Sous-formulaires typés par type de mission. La forme du `config` est
 * dérivée de `src/lib/bitquest/missions.ts` (chaque `gen<Type>(config)`).
 *
 * Contrat :
 *   - Chaque sous-form reçoit `config` + `onChange(nextConfig)`.
 *   - Les types sans config (block_explorer, key_forge, ln_channel,
 *     taproot_tweak) rendent juste un message informatif.
 *   - Le parent `MissionEditor` peut toujours basculer en mode JSON brut
 *     pour éditer des clés custom non prévues par ces builders.
 */

import type { ChangeEvent } from "react";

type Cfg = Record<string, unknown>;

const num = (v: unknown, fallback: number): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v)) return Number(v);
  return fallback;
};
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/* ----------------- No-config missions ----------------- */

export function NoConfigHint({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
      <strong>{label}</strong> ne consomme pas de config — le défi est
      généré aléatoirement à chaque session apprenant. Laisse la config vide
      ou n&apos;y mets que des clés que tu consommerais côté UI custom.
    </div>
  );
}

/* ----------------- tx_builder ----------------- */

const TX_VARIANTS = ["payment", "consolidation", "fee_opt"] as const;
type TxVariant = (typeof TX_VARIANTS)[number];

export function TxBuilderForm({ config, onChange }: { config: Cfg; onChange: (c: Cfg) => void }) {
  const variant = (str(config.variant, "payment") as TxVariant);
  const target = num(config.target, 45_000);
  const feeSats = (config.feeSats as Record<string, number> | undefined) ?? {
    slow: 800,
    medium: 2000,
    fast: 5000,
  };
  const vbytes = num(config.vbytes, 250);
  const feeRates = (config.feeRates as Record<string, number> | undefined) ?? {
    slow: 5,
    medium: 25,
    fast: 80,
  };

  const update = (partial: Cfg) => onChange({ ...config, ...partial });

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="block font-medium">Variante</span>
        <select
          value={variant}
          onChange={(e) => update({ variant: e.target.value as TxVariant })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          <option value="payment">payment — un paiement unique avec change</option>
          <option value="consolidation">consolidation — fusionne tous les UTXOs</option>
          <option value="fee_opt">fee_opt — choix de la priorité de frais</option>
        </select>
      </label>

      {variant === "payment" && (
        <label className="block text-sm">
          <span className="block font-medium">Montant cible (sats)</span>
          <input
            type="number"
            min={1_000}
            value={target}
            onChange={(e) => update({ target: num(e.target.value, 45_000) })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      )}

      {variant !== "fee_opt" && (
        <fieldset className="rounded-md border p-3">
          <legend className="px-1 text-xs font-medium">Frais totaux (sats)</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["slow", "medium", "fast"] as const).map((tier) => (
              <label key={tier} className="block text-xs">
                <span className="block capitalize text-muted-foreground">{tier}</span>
                <input
                  type="number"
                  min={0}
                  value={feeSats[tier] ?? 0}
                  onChange={(e) =>
                    update({ feeSats: { ...feeSats, [tier]: num(e.target.value, 0) } })
                  }
                  className="mt-0.5 w-full rounded-md border bg-background px-2 py-1 text-sm"
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {variant === "fee_opt" && (
        <>
          <label className="block text-sm">
            <span className="block font-medium">Taille (vbytes)</span>
            <input
              type="number"
              min={50}
              value={vbytes}
              onChange={(e) => update({ vbytes: num(e.target.value, 250) })}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-xs font-medium">Taux de frais (sats/vB)</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["slow", "medium", "fast"] as const).map((tier) => (
                <label key={tier} className="block text-xs">
                  <span className="block capitalize text-muted-foreground">{tier}</span>
                  <input
                    type="number"
                    min={0}
                    value={feeRates[tier] ?? 0}
                    onChange={(e) =>
                      update({ feeRates: { ...feeRates, [tier]: num(e.target.value, 0) } })
                    }
                    className="mt-0.5 w-full rounded-md border bg-background px-2 py-1 text-sm"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}

/* ----------------- mine_nonce ----------------- */

const DIFFICULTY_PRESETS = ["00", "000", "0000", "00000"] as const;

export function MineNonceForm({ config, onChange }: { config: Cfg; onChange: (c: Cfg) => void }) {
  const difficulty = str(config.difficulty, "000");
  const maxNonce = num(config.maxNonce, 60_000);
  const update = (partial: Cfg) => onChange({ ...config, ...partial });

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="block font-medium">Difficulté (préfixe cible)</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="text"
            pattern="0+"
            value={difficulty}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              update({ difficulty: e.target.value.replace(/[^0]/g, "") || "0" })
            }
            className="w-32 rounded-md border bg-background px-2 py-1.5 font-mono text-sm"
          />
          <div className="flex gap-1">
            {DIFFICULTY_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => update({ difficulty: d })}
                className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                  difficulty === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <span className="mt-1 block text-[11px] text-muted-foreground">
          Nombre de zéros exigés en début du hash sha256 (chaque 0 supplémentaire
          ≈ 16× plus difficile).
        </span>
      </label>
      <label className="block text-sm">
        <span className="block font-medium">Nonce max à tester</span>
        <input
          type="number"
          min={1_000}
          max={1_000_000}
          value={maxNonce}
          onChange={(e) => update({ maxNonce: num(e.target.value, 60_000) })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>
    </div>
  );
}

/* ----------------- ln_invoice ----------------- */

const EXPIRY_PRESETS = [
  { label: "10 min", value: 600 },
  { label: "30 min", value: 1800 },
  { label: "1 h", value: 3600 },
  { label: "2 h", value: 7200 },
] as const;

export function LnInvoiceForm({ config, onChange }: { config: Cfg; onChange: (c: Cfg) => void }) {
  const amountSats = num(config.amountSats, 10_000);
  const expiry = num(config.expiry, 3_600);
  const update = (partial: Cfg) => onChange({ ...config, ...partial });

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="block font-medium">Montant (sats)</span>
        <input
          type="number"
          min={1}
          value={amountSats}
          onChange={(e) => update({ amountSats: num(e.target.value, 10_000) })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="block font-medium">Expiration (secondes)</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min={60}
            value={expiry}
            onChange={(e) => update({ expiry: num(e.target.value, 3600) })}
            className="w-32 rounded-md border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex gap-1">
            {EXPIRY_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => update({ expiry: p.value })}
                className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                  expiry === p.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </label>
    </div>
  );
}

/* ----------------- multisig_sign ----------------- */

const MULTISIG_POLICIES = ["2-of-3", "3-of-5", "2-of-2", "3-of-4"] as const;

export function MultisigForm({ config, onChange }: { config: Cfg; onChange: (c: Cfg) => void }) {
  const policy = str(config.policy, "2-of-3");
  const update = (partial: Cfg) => onChange({ ...config, ...partial });

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="block font-medium">Politique (m-of-n)</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="text"
            value={policy}
            onChange={(e) => update({ policy: e.target.value })}
            pattern="\d+-of-\d+"
            placeholder="2-of-3"
            className="w-32 rounded-md border bg-background px-2 py-1.5 font-mono text-sm"
          />
          <div className="flex gap-1">
            {MULTISIG_POLICIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update({ policy: p })}
                className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                  policy === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <span className="mt-1 block text-[11px] text-muted-foreground">
          Format <code>m-of-n</code> — ex. <code>2-of-3</code> : 2 signatures
          requises sur 3 clés.
        </span>
      </label>
    </div>
  );
}
