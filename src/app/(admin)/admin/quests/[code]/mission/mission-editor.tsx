"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";

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
 * Éditeur mission : type + brief + hint + config JSON.
 *
 * La config type-spécifique (target, feeRates, policy, difficulty, …) est
 * éditée comme JSON brut. Pas d'éditeur par type cette étape — un builder
 * dédié pourra arriver plus tard sans invalider cette page.
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
  const [configText, setConfigText] = useState(() => JSON.stringify(initial.config, null, 2));

  const configError = useMemo<string | null>(() => {
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
  }, [configText]);

  const onSave = async () => {
    setError(null);
    setSaved(false);
    if (configError) {
      setError("Corrige le JSON de la config avant d'enregistrer.");
      return;
    }
    const config = configText.trim() ? (JSON.parse(configText) as Record<string, unknown>) : {};
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/quests/${code}/mission`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ missionType, brief, hint, config }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
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

      <label className="block text-sm">
        <span className="block font-medium">Config JSON (avancé)</span>
        <textarea
          rows={10}
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          spellCheck={false}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Objet JSON transmis à <code>generateMission({missionType}, config)</code>. Les clés
          <code> brief </code> et <code> hint </code> sont injectées automatiquement par le serveur
          — inutile de les mettre ici.
        </span>
      </label>
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
