"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";
import {
  LnInvoiceForm,
  MineNonceForm,
  MultisigForm,
  NoConfigHint,
  TxBuilderForm,
} from "./mission-type-forms";

const MISSION_TYPES = [
  "block_explorer",
  "key_forge",
  "tx_builder",
  "mine_nonce",
  "ln_channel",
  "ln_invoice",
  "multisig_sign",
  "taproot_tweak",
] as const;

type MissionType = (typeof MISSION_TYPES)[number];

const TYPE_LABELS: Record<MissionType, string> = {
  block_explorer: "Block Explorer",
  key_forge: "Key Forge",
  tx_builder: "Transaction Builder",
  mine_nonce: "Mine Nonce",
  ln_channel: "Lightning Channel",
  ln_invoice: "Lightning Invoice",
  multisig_sign: "Multisig Sign",
  taproot_tweak: "Taproot Tweak",
};

/**
 * Éditeur mission : type + brief + hint + config typé (ou JSON brut).
 *
 * - 4 missions typées ont un sous-form structuré : tx_builder, mine_nonce,
 *   ln_invoice, multisig_sign.
 * - 4 missions sans config renvoient juste un hint (le défi est généré
 *   aléatoirement à chaque session).
 * - Un toggle « JSON avancé » reste disponible pour les clés custom non
 *   prévues par les builders (générateurs UI custom, flags expérimentaux).
 */
export function MissionEditor({
  code,
  initial,
}: {
  code: string;
  initial: {
    missionType: MissionType;
    brief: string;
    hint: string;
    config: Record<string, unknown>;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [missionType, setMissionType] = useState<MissionType>(initial.missionType);
  const [brief, setBrief] = useState(initial.brief);
  const [hint, setHint] = useState(initial.hint);
  const [config, setConfig] = useState<Record<string, unknown>>(initial.config);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [configText, setConfigText] = useState(() => JSON.stringify(initial.config, null, 2));

  // Validation JSON pour le mode avancé — silencieux si mode structuré.
  const configError = useMemo<string | null>(() => {
    if (!advancedMode) return null;
    if (configText.trim().length === 0) return null;
    try {
      const parsed = JSON.parse(configText);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return "Le JSON doit être un objet { ... }.";
      }
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "JSON invalide.";
    }
  }, [configText, advancedMode]);

  // Toggle mode : on resynchronise les deux représentations avant de
  // basculer, pour ne pas perdre les modifications en cours.
  const toggleAdvanced = () => {
    if (advancedMode) {
      // Avancé → structuré : on reparse ce qui vient du textarea.
      try {
        const parsed = JSON.parse(configText || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setConfig(parsed as Record<string, unknown>);
        }
      } catch {
        // garde le state actuel si parse échoue
      }
    } else {
      // Structuré → avancé : serialize la config courante.
      setConfigText(JSON.stringify(config, null, 2));
    }
    setAdvancedMode((v) => !v);
  };

  const onSave = async () => {
    setError(null);
    setSaved(false);
    if (configError) {
      setError("Corrige le JSON de la config avant d'enregistrer.");
      return;
    }
    const nextConfig = advancedMode
      ? configText.trim()
        ? (JSON.parse(configText) as Record<string, unknown>)
        : {}
      : config;
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/quests/${code}/mission`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ missionType, brief, hint, config: nextConfig }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  const renderTypedForm = () => {
    switch (missionType) {
      case "tx_builder":
        return <TxBuilderForm config={config} onChange={setConfig} />;
      case "mine_nonce":
        return <MineNonceForm config={config} onChange={setConfig} />;
      case "ln_invoice":
        return <LnInvoiceForm config={config} onChange={setConfig} />;
      case "multisig_sign":
        return <MultisigForm config={config} onChange={setConfig} />;
      case "block_explorer":
      case "key_forge":
      case "ln_channel":
      case "taproot_tweak":
        return <NoConfigHint label={TYPE_LABELS[missionType]} />;
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="block font-medium">Type de mission</span>
        <select
          value={missionType}
          onChange={(e) => setMissionType(e.target.value as MissionType)}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          {MISSION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]} ({t})
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted-foreground">
          Choisir un type qui a une config incompatible peut rendre la mission non générable
          côté BitLab. Teste la quête en mode apprenant après un changement.
        </span>
      </label>

      <label className="block text-sm">
        <span className="block font-medium">Brief (consigne principale)</span>
        <textarea
          rows={4}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">Hint (indice optionnel)</span>
        <textarea
          rows={3}
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Laisse vide si la mission n'a pas besoin d'indice."
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="block text-sm font-medium">Config mission</span>
          <button
            type="button"
            onClick={toggleAdvanced}
            className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            aria-pressed={advancedMode}
          >
            {advancedMode ? "Vue structurée" : "JSON avancé"}
          </button>
        </div>
        {advancedMode ? (
          <>
            <textarea
              rows={10}
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              spellCheck={false}
              className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Objet JSON transmis à <code>generateMission({missionType}, config)</code>. Les clés
              <code> brief </code> et <code> hint </code> sont injectées automatiquement par le serveur
              — inutile de les mettre ici.
            </span>
          </>
        ) : (
          renderTypedForm()
        )}
      </div>
      {configError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          JSON invalide : {configError}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          Mission enregistrée.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || configError !== null}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          Enregistrer la mission
        </button>
      </div>
    </div>
  );
}
