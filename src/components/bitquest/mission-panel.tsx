"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Check,
  CircleAlert,
  Copy,
  FlaskConical,
  HelpCircle,
  KeyRound,
  Lightbulb,
  Loader2,
  Network,
  Pickaxe,
  Receipt,
  ShieldCheck,
  Square,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatSats } from "@/lib/bitquest/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/* ============ Contrat public ============ */

export interface MissionPanelProps {
  missionType: string;
  challenge: Record<string, unknown>;
  brief: string | null;
  hint: string | null;
  attemptsLeft: number;
  submitting: boolean;
  lastFeedback: { success: boolean; feedback: string } | null;
  onSubmit: (answer: Record<string, unknown>) => void;
  disabled?: boolean;
}

/* ============ Helpers de typage local ============ */

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function listOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

interface MissionComponentProps {
  challenge: Record<string, unknown>;
  hint: string | null;
  attemptsLeft: number;
  submitting: boolean;
  disabled?: boolean;
  onSubmit: (answer: Record<string, unknown>) => void;
}

/* ============ Structure commune ============ */

function MissionFrame({
  children,
  hint,
  answer,
  attemptsLeft,
  submitting,
  disabled,
  onSubmit,
}: {
  children: React.ReactNode;
  hint: string | null;
  answer: Record<string, unknown> | null;
  attemptsLeft: number;
  submitting: boolean;
  disabled?: boolean;
  onSubmit: (answer: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {children}
      {hint && (
        <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-medium">Indice : </span>
            {hint}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          className="h-10 w-full sm:w-auto"
          disabled={submitting || disabled || !answer}
          onClick={() => answer && onSubmit(answer)}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {submitting ? "Vérification en cours…" : "Soumettre à BitLab"}
        </Button>
        <span className="text-center text-xs text-muted-foreground sm:text-right">
          Tentatives restantes : {Math.max(0, attemptsLeft)}
        </span>
      </div>
    </div>
  );
}

function MonoField({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <code className={cn("font-mono text-xs", truncate && "truncate")} title={value}>
        {value}
      </code>
    </div>
  );
}

/* ============ 1. block_explorer ============ */

function BlockExplorerMission({
  challenge,
  hint,
  attemptsLeft,
  submitting,
  disabled,
  onSubmit,
}: MissionComponentProps) {
  const { toast } = useToast();
  const c = asRecord(challenge);
  const height = num(c.height);
  const hash = str(c.hash);
  const [txCount, setTxCount] = useState("");
  const [suffix, setSuffix] = useState("");
  const [copied, setCopied] = useState(false);

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      toast({ title: "Hash complet copié dans le presse-papiers" });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({
        variant: "destructive",
        title: "Copie impossible",
        description: "Ton navigateur a refusé l'accès au presse-papiers.",
      });
    }
  };

  const answer =
    txCount !== "" && suffix.trim().length === 6
      ? { txCount: Number(txCount), hashSuffix: suffix.trim().toLowerCase() }
      : null;

  return (
    <MissionFrame
      hint={hint}
      answer={answer}
      attemptsLeft={attemptsLeft}
      submitting={submitting}
      disabled={disabled}
      onSubmit={onSubmit}
    >
      <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-display text-2xl font-bold tracking-tight text-primary">
            #{formatSats(height)}
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary">
            Bloc miné
          </Badge>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs" title={hash}>
            {hash.slice(0, 18)}…{hash.slice(-10)}
          </code>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={copyHash}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copié" : "Copier"}
          </Button>
        </div>
        <div className="space-y-1.5">
          <MonoField label="Nonce" value={formatSats(num(c.nonce))} />
          <MonoField label="Size" value={`${formatSats(num(c.size))} octets`} />
          <MonoField label="Timestamp" value={new Date(str(c.timestamp)).toLocaleString("fr-FR")} />
          <MonoField label="Miner" value={str(c.miner)} />
          <MonoField label="Difficulty" value={str(c.difficulty)} />
          <MonoField label="Transactions" value={formatSats(num(c.txCount))} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bq-tx-count">Nombre de transactions</Label>
          <Input
            id="bq-tx-count"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Recopie la valeur affichée"
            value={txCount}
            onChange={(e) => setTxCount(e.target.value)}
            disabled={submitting || disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bq-hash-suffix">6 derniers caractères du hash</Label>
          <Input
            id="bq-hash-suffix"
            className="font-mono"
            maxLength={6}
            placeholder="ex. 3f9a2c"
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            disabled={submitting || disabled}
          />
        </div>
      </div>
    </MissionFrame>
  );
}

/* ============ 2. key_forge ============ */

function KeyForgeMission({
  challenge,
  hint,
  attemptsLeft,
  submitting,
  disabled,
  onSubmit,
}: MissionComponentProps) {
  const c = asRecord(challenge);
  const wif = str(c.wif);
  const pubkey = str(c.pubkey);
  const address = str(c.address);
  const network = str(c.network, "Testnet");

  const [phase, setPhase] = useState<"idle" | "forging" | "forged">("idle");
  const [suffix, setSuffix] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const forge = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("forging");
    timerRef.current = setTimeout(() => setPhase("forged"), 1100);
  };

  const answer =
    phase === "forged" && suffix.trim().length === 4 ? { addressSuffix: suffix.trim().toLowerCase() } : null;

  return (
    <MissionFrame
      hint={hint}
      answer={answer}
      attemptsLeft={attemptsLeft}
      submitting={submitting}
      disabled={disabled}
      onSubmit={onSubmit}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            <KeyRound className="h-3 w-3" />
            {network}
          </Badge>
          {phase === "idle" && (
            <Button type="button" className="h-10" onClick={forge}>
              <Zap className="h-4 w-4" />
              Forger la paire de clés
            </Button>
          )}
        </div>

        {phase === "forging" && (
          <div className="overflow-hidden rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Génération des clés via l&apos;entropie du sandbox…
            </div>
            <motion.div
              className="mt-3 h-1.5 rounded-full bg-primary/30"
              initial={{ width: "10%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.05, ease: "easeInOut" }}
            />
          </div>
        )}

        {phase === "forged" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3 rounded-xl border bg-muted/30 p-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="shrink-0 text-xs text-muted-foreground">WIF (clé privée)</span>
              </div>
              <code
                className="block select-none break-all rounded-lg border bg-background px-3 py-2 font-mono text-xs blur-[2px]"
                title="Clé privée masquée — ne jamais partager"
              >
                {wif}
              </code>
              <p className="text-[11px] text-rose-500">
                Clé privée masquée — ne jamais partager, ne jamais la coller en ligne.
              </p>
            </div>
            <MonoField label="Clé publique" value={`${pubkey.slice(0, 20)}…${pubkey.slice(-8)}`} />
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Adresse</span>
              <code className="block break-all rounded-lg border bg-background px-3 py-2 font-mono text-xs text-primary">
                {address}
              </code>
            </div>
          </motion.div>
        )}

        {phase === "forged" && (
          <div className="space-y-1.5">
            <Label htmlFor="bq-address-suffix">4 derniers caractères de l&apos;adresse</Label>
            <Input
              id="bq-address-suffix"
              className="max-w-xs font-mono"
              maxLength={4}
              placeholder="ex. 7xk2"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              disabled={submitting || disabled}
            />
            <p className="text-[11px] text-muted-foreground">
              Réflexe de sécurité : vérifie toujours les derniers caractères d&apos;une adresse avant
              d&apos;envoyer des fonds.
            </p>
          </div>
        )}
      </div>
    </MissionFrame>
  );
}

/* ============ 3. tx_builder (payment / consolidation) ============ */

function TxBuilderMission({
  challenge,
  hint,
  attemptsLeft,
  submitting,
  disabled,
  onSubmit,
}: MissionComponentProps) {
  const c = asRecord(challenge);
  const variant = str(c.variant, "payment");
  const isConsolidation = variant === "consolidation";
  const utxos = listOf(c.utxos).map((u) => {
    const o = asRecord(u);
    return { id: str(o.id), sats: num(o.sats) };
  });
  const target = num(c.target);
  const recipient = str(c.recipient);
  const feeSatsRaw = asRecord(c.feeSats);
  const feeSats = {
    slow: num(feeSatsRaw.slow),
    medium: num(feeSatsRaw.medium),
    fast: num(feeSatsRaw.fast),
  };

  const [selected, setSelected] = useState<string[]>([]);
  const [speed, setSpeed] = useState<"slow" | "medium" | "fast" | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const selectedSum = utxos.filter((u) => selected.includes(u.id)).reduce((acc, u) => acc + u.sats, 0);
  const fee = speed ? feeSats[speed] : 0;
  const missing = target + fee - selectedSum;
  const change = selectedSum - target - fee;
  const enough = selectedSum >= target + fee;

  const speeds: { key: "slow" | "medium" | "fast"; label: string }[] = [
    { key: "slow", label: "Lent" },
    { key: "medium", label: "Moyen" },
    { key: "fast", label: "Rapide" },
  ];

  const answer = selected.length > 0 && speed ? { selected, speed } : null;

  return (
    <MissionFrame
      hint={hint}
      answer={answer}
      attemptsLeft={attemptsLeft}
      submitting={submitting}
      disabled={disabled}
      onSubmit={onSubmit}
    >
      <div className="space-y-4">
        {isConsolidation && (
          <Alert>
            <Activity className="h-4 w-4" />
            <AlertTitle>Consolidation</AlertTitle>
            <AlertDescription>
              {str(c.label)} — sélectionne TOUS les UTXO ({selected.length}/{utxos.length} sélectionnés).
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">
              {isConsolidation ? "Total du wallet" : "Montant à envoyer"}
            </div>
            <div className="text-lg font-bold text-primary">
              {formatSats(isConsolidation ? num(c.total) : target)} sats
            </div>
          </div>
          <div className="min-w-0 rounded-xl border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Destinataire</div>
            <code className="block truncate font-mono text-xs" title={recipient}>
              {recipient}
            </code>
          </div>
        </div>

        <div className="space-y-2">
          <Label>UTXO disponibles (coche ceux à dépenser)</Label>
          <div className="space-y-2">
            {utxos.map((u) => (
              <label
                key={u.id}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                  selected.includes(u.id) ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-accent/40",
                )}
              >
                <Checkbox
                  checked={selected.includes(u.id)}
                  onCheckedChange={() => toggle(u.id)}
                  disabled={submitting || disabled}
                  aria-label={`UTXO ${u.id}`}
                />
                <code className="min-w-0 flex-1 truncate font-mono text-xs" title={u.id}>
                  {u.id}
                </code>
                <span className="shrink-0 font-mono text-xs font-semibold">{formatSats(u.sats)} sats</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Sélectionné :{" "}
              <span className="font-semibold text-foreground">{formatSats(selectedSum)} sats</span>
              {isConsolidation && ` · ${selected.length}/${utxos.length} UTXO`}
            </span>
            {!isConsolidation && (
              <span className={cn("font-medium", enough ? "text-emerald-500" : "text-rose-500")}>
                {enough
                  ? `Suffisant — change estimé : ${formatSats(Math.max(0, change))} sats`
                  : `Insuffisant — il manque ${formatSats(Math.max(0, missing))} sats`}
              </span>
            )}
            {isConsolidation && speed && (
              <span
                className={cn("font-medium", selectedSum - fee > 0 ? "text-emerald-500" : "text-rose-500")}
              >
                {selectedSum - fee > 0
                  ? `Change estimé après frais : ${formatSats(selectedSum - fee)} sats`
                  : "Les frais dépassent le total sélectionné"}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Vitesse de confirmation (frais)</Label>
          <RadioGroup
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            value={speed ?? ""}
            onValueChange={(v) => setSpeed(v as "slow" | "medium" | "fast")}
            disabled={submitting || disabled}
          >
            {speeds.map((s) => (
              <Label
                key={s.key}
                htmlFor={`bq-speed-${s.key}`}
                className={cn(
                  "min-h-10 cursor-pointer items-center justify-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  speed === s.key ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40",
                )}
              >
                <RadioGroupItem id={`bq-speed-${s.key}`} value={s.key} />
                <span className="min-w-0">
                  <span className="block font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatSats(feeSats[s.key])} sats
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </div>
    </MissionFrame>
  );
}

/* ============ 3c. tx_builder fee_opt ============ */

function FeeOptMission({
  challenge,
  hint,
  attemptsLeft,
  submitting,
  disabled,
  onSubmit,
}: MissionComponentProps) {
  const c = asRecord(challenge);
  const vbytes = num(c.vbytes);
  const feeRatesRaw = asRecord(c.feeRates);
  const feeRates = {
    slow: num(feeRatesRaw.slow),
    medium: num(feeRatesRaw.medium),
    fast: num(feeRatesRaw.fast),
  };
  const mempool = str(c.mempool, "état du mempool inconnu");
  const nextBlockRate = num(c.nextBlockRate);

  const [speed, setSpeed] = useState<"slow" | "medium" | "fast" | null>(null);
  const [totalFee, setTotalFee] = useState("");

  const answer = speed && totalFee !== "" ? { speed, totalFee: Number(totalFee) } : null;

  const rates: { key: "slow" | "medium" | "fast"; label: string }[] = [
    { key: "slow", label: "Lent" },
    { key: "medium", label: "Moyen" },
    { key: "fast", label: "Rapide" },
  ];

  return (
    <MissionFrame
      hint={hint}
      answer={answer}
      attemptsLeft={attemptsLeft}
      submitting={submitting}
      disabled={disabled}
      onSubmit={onSubmit}
    >
      <div className="space-y-4">
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertTitle>Mempool : {mempool}</AlertTitle>
          <AlertDescription>
            Taux estimé pour le prochain bloc : {nextBlockRate} sats/vByte. Taille de ta transaction :{" "}
            {formatSats(vbytes)} vBytes.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {rates.map((r) => (
            <div key={r.key} className="rounded-xl border bg-muted/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">{r.label}</div>
              <div className="text-lg font-bold">{feeRates[r.key]}</div>
              <div className="text-[11px] text-muted-foreground">sats/vByte</div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Vitesse choisie</Label>
          <RadioGroup
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            value={speed ?? ""}
            onValueChange={(v) => setSpeed(v as "slow" | "medium" | "fast")}
            disabled={submitting || disabled}
          >
            {rates.map((r) => (
              <Label
                key={r.key}
                htmlFor={`bq-fee-${r.key}`}
                className={cn(
                  "min-h-10 cursor-pointer items-center justify-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  speed === r.key ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40",
                )}
              >
                <RadioGroupItem id={`bq-fee-${r.key}`} value={r.key} />
                <span className="font-medium">{r.label}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bq-total-fee">Frais totaux en sats (taux × {formatSats(vbytes)} vBytes)</Label>
          <Input
            id="bq-total-fee"
            type="number"
            inputMode="numeric"
            min={0}
            className="max-w-xs"
            placeholder="ex. 2000"
            value={totalFee}
            onChange={(e) => setTotalFee(e.target.value)}
            disabled={submitting || disabled}
          />
          <p className="text-[11px] text-muted-foreground">
            À toi de calculer : frais = taux (sats/vByte) × taille (vBytes).
          </p>
        </div>
      </div>
    </MissionFrame>
  );
}

/* ============ 4. mine_nonce ============ */

const MINE_BATCH = 500;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function MineNonceMission({
  challenge,
  hint,
  attemptsLeft,
  submitting,
  disabled,
  onSubmit,
}: MissionComponentProps) {
  const { toast } = useToast();
  const c = asRecord(challenge);
  const header = str(c.header);
  const prefix = str(c.prefix, "000");
  const maxNonce = num(c.maxNonce, 60_000);

  const [nonce, setNonce] = useState("");
  const [mining, setMining] = useState(false);
  const [currentNonce, setCurrentNonce] = useState(0);
  const [hashCount, setHashCount] = useState(0);
  const [hashrate, setHashrate] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [foundHash, setFoundHash] = useState<string | null>(null);
  const miningRef = useRef(false);

  useEffect(() => {
    return () => {
      miningRef.current = false;
    };
  }, []);

  const stopMining = () => {
    miningRef.current = false;
    setMining(false);
  };

  const autoMine = async () => {
    if (miningRef.current) return;
    miningRef.current = true;
    setMining(true);
    setFoundHash(null);
    const start = performance.now();
    let hashes = 0;

    try {
      for (let base = 0; base <= maxNonce; base += MINE_BATCH) {
        if (!miningRef.current) break;
        const end = Math.min(base + MINE_BATCH, maxNonce + 1);
        for (let n = base; n < end; n++) {
          const h = await sha256Hex(header + n);
          hashes++;
          if (h.startsWith(prefix)) {
            miningRef.current = false;
            setMining(false);
            setNonce(String(n));
            setFoundHash(h);
            setCurrentNonce(n);
            setHashCount(hashes);
            setProgressPct(100);
            toast({
              title: "Hash valide trouvé !",
              description: `Nonce ${n} après ${hashes} hash calculés.`,
            });
            return;
          }
        }
        setCurrentNonce(end - 1);
        setHashCount(hashes);
        setProgressPct((end / (maxNonce + 1)) * 100);
        const elapsed = (performance.now() - start) / 1000;
        if (elapsed > 0.05) setHashrate(Math.round(hashes / elapsed));
        await new Promise((r) => setTimeout(r));
      }
    } finally {
      miningRef.current = false;
      setMining(false);
    }
  };

  const answer = nonce !== "" ? { nonce: Number(nonce) } : null;

  return (
    <MissionFrame
      hint={hint}
      answer={answer}
      attemptsLeft={attemptsLeft}
      submitting={submitting}
      disabled={disabled}
      onSubmit={onSubmit}
    >
      <div className="space-y-4">
        <div className="space-y-1.5 rounded-xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">En-tête du bloc (header)</span>
            <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-500">
              <Pickaxe className="h-3 w-3" />
              Cible : hash commençant par « {prefix} »
            </Badge>
          </div>
          <code className="block break-all rounded-lg border bg-background px-3 py-2 font-mono text-xs">
            {header}
          </code>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bq-nonce">Nonce à soumettre</Label>
            <Input
              id="bq-nonce"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Trouve le bon nonce"
              value={nonce}
              onChange={(e) => setNonce(e.target.value)}
              disabled={submitting || disabled}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={autoMine}
              disabled={mining || submitting || disabled}
            >
              {mining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pickaxe className="h-4 w-4" />}
              {mining ? "Minage en cours…" : "Miner automatiquement"}
            </Button>
            {mining && (
              <Button type="button" variant="ghost" className="h-10" onClick={stopMining}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}
          </div>
        </div>

        {mining && (
          <div className="space-y-1.5">
            <Progress value={progressPct} className="h-2" />
            <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted-foreground">
              <span>nonce courant : {currentNonce}</span>
              <span>{formatSats(hashCount)} hash calculés</span>
              <span>{formatSats(hashrate)} H/s</span>
            </div>
          </div>
        )}

        {foundHash && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Hash valide trouvé</span>
            <code className="block break-all rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-mono text-xs text-emerald-500">
              {foundHash}
            </code>
          </div>
        )}
      </div>
    </MissionFrame>
  );
}

/* ============ 5. ln_channel ============ */

function LnChannelMission({
  challenge,
  hint,
  attemptsLeft,
  submitting,
  disabled,
  onSubmit,
}: MissionComponentProps) {
  const c = asRecord(challenge);
  const myBalance = num(c.myBalance);
  const dustLimit = num(c.dustLimit);
  const peers = listOf(c.peers).map((p) => {
    const o = asRecord(p);
    return {
      name: str(o.name),
      pubkey: str(o.pubkey),
      minCapacity: num(o.minCapacity),
      baseFee: num(o.baseFee),
      uptime: num(o.uptime),
      channels: num(o.channels),
    };
  });

  const [peerIndex, setPeerIndex] = useState<number | null>(null);
  const [capacity, setCapacity] = useState("");

  const peer = peerIndex !== null ? peers[peerIndex] : undefined;
  const capacityNum = capacity !== "" ? Number(capacity) : null;
  const valid =
    peer !== undefined &&
    capacityNum !== null &&
    Number.isFinite(capacityNum) &&
    capacityNum >= peer.minCapacity &&
    capacityNum >= dustLimit &&
    capacityNum <= myBalance;

  const answer = peerIndex !== null && capacityNum !== null ? { peerIndex, capacity: capacityNum } : null;

  return (
    <MissionFrame
      hint={hint}
      answer={answer}
      attemptsLeft={attemptsLeft}
      submitting={submitting}
      disabled={disabled}
      onSubmit={onSubmit}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 p-3">
          <span className="text-sm text-muted-foreground">Solde BitLab disponible</span>
          <span className="text-lg font-bold text-amber-500">{formatSats(myBalance)} sats</span>
        </div>

        <div className="space-y-2">
          <Label>Choisis un pair pour ouvrir un canal</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {peers.map((p, i) => (
              <button
                key={p.pubkey}
                type="button"
                onClick={() => setPeerIndex(i)}
                aria-pressed={peerIndex === i}
                className={cn(
                  "min-h-10 rounded-xl border p-3 text-left transition-colors",
                  peerIndex === i
                    ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
                    : "bg-card hover:bg-accent/40",
                  submitting || disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
                disabled={submitting || disabled}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Network className="h-3.5 w-3.5 text-primary" />
                    {p.name}
                  </span>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                    min. {formatSats(p.minCapacity)} sats
                  </Badge>
                </div>
                <code
                  className="mt-1 block truncate font-mono text-[11px] text-muted-foreground"
                  title={p.pubkey}
                >
                  {p.pubkey.slice(0, 16)}…{p.pubkey.slice(-6)}
                </code>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                  <span>uptime {p.uptime} %</span>
                  <span>{formatSats(p.channels)} canaux</span>
                  <span>frais base {p.baseFee} sat</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bq-capacity">Capacité locale du canal (sats)</Label>
          <Input
            id="bq-capacity"
            type="number"
            inputMode="numeric"
            min={0}
            className="max-w-xs"
            placeholder="ex. 50000"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            disabled={submitting || disabled}
          />
          <p className="text-[11px] text-muted-foreground">
            Contraintes : capacité ≥ {peer ? formatSats(peer.minCapacity) : "min. du pair"} sats (exigence du
            pair), ≥ {formatSats(dustLimit)} sats (dust limit) et ≤ {formatSats(myBalance)} sats (ton solde).
          </p>
          {peer && capacityNum !== null && !valid && (
            <p className="text-[11px] font-medium text-rose-500">
              Capacité invalide pour {peer.name} — ajuste-la pour respecter les contraintes ci-dessus.
            </p>
          )}
          {valid && (
            <p className="text-[11px] font-medium text-emerald-500">Capacité valide pour {peer?.name}.</p>
          )}
        </div>
      </div>
    </MissionFrame>
  );
}

/* ============ 6. ln_invoice ============ */

function LnInvoiceMission({
  challenge,
  hint,
  attemptsLeft,
  submitting,
  disabled,
  onSubmit,
}: MissionComponentProps) {
  const c = asRecord(challenge);
  const bolt11 = str(c.bolt11);
  const payeeNode = str(c.payeeNode);
  const description = str(c.description);

  const [amount, setAmount] = useState("");
  const [expiry, setExpiry] = useState("");

  const answer = amount !== "" && expiry !== "" ? { amount: Number(amount), expiry: Number(expiry) } : null;

  return (
    <MissionFrame
      hint={hint}
      answer={answer}
      attemptsLeft={attemptsLeft}
      submitting={submitting}
      disabled={disabled}
      onSubmit={onSubmit}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" />
            Facture BOLT11 · émise par <span className="font-medium text-foreground">{payeeNode}</span>
          </div>
          <pre className="overflow-x-auto rounded-lg border bg-background px-3 py-2 font-mono text-xs leading-relaxed whitespace-nowrap">
            {bolt11}
          </pre>
          <p className="text-[11px] text-muted-foreground">Description : {description}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bq-invoice-amount">Montant (sats)</Label>
            <Input
              id="bq-invoice-amount"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Décode-le de la facture"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting || disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bq-invoice-expiry">Expiration (secondes)</Label>
            <Input
              id="bq-invoice-expiry"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Décode-le de la facture"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              disabled={submitting || disabled}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          La facture est du texte lisible si tu sais où regarder : le montant suit le préfixe « lntb » et
          l&apos;expiration suit le marqueur « exp ».
        </p>
      </div>
    </MissionFrame>
  );
}

/* ============ 7. multisig_sign ============ */

function MultisigMission({
  challenge,
  hint,
  attemptsLeft,
  submitting,
  disabled,
  onSubmit,
}: MissionComponentProps) {
  const c = asRecord(challenge);
  const policy = str(c.policy, "2-of-3");
  const m = num(c.m, 2);
  const n = num(c.n, 3);
  const txLabel = str(c.txLabel);
  const keys = listOf(c.keys).map((k) => {
    const o = asRecord(k);
    return { label: str(o.label), pubkey: str(o.pubkey) };
  });

  const [signers, setSigners] = useState<number[]>([]);

  const toggle = (i: number) => {
    setSigners((prev) => (prev.includes(i) ? prev.filter((s) => s !== i) : [...prev, i]));
  };

  const answer = signers.length === m ? { signers } : null;

  return (
    <MissionFrame
      hint={hint}
      answer={answer}
      attemptsLeft={attemptsLeft}
      submitting={submitting}
      disabled={disabled}
      onSubmit={onSubmit}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            <ShieldCheck className="h-3 w-3" />
            Politique {policy}
          </Badge>
          {txLabel && <span className="truncate text-xs text-muted-foreground">Transaction : {txLabel}</span>}
        </div>

        <div className="space-y-2">
          <Label>
            Coche les {m} clés qui signeront ({signers.length}/{m} sélectionnées, {n} disponibles)
          </Label>
          <div className="space-y-2">
            {keys.map((k, i) => (
              <label
                key={k.pubkey}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                  signers.includes(i) ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-accent/40",
                )}
              >
                <Checkbox
                  checked={signers.includes(i)}
                  onCheckedChange={() => toggle(i)}
                  disabled={submitting || disabled}
                  aria-label={`Signer avec ${k.label}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{k.label}</span>
                  <code
                    className="block truncate font-mono text-[11px] text-muted-foreground"
                    title={k.pubkey}
                  >
                    {k.pubkey.slice(0, 20)}…{k.pubkey.slice(-6)}
                  </code>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </MissionFrame>
  );
}

/* ============ 8. taproot_tweak ============ */

function TaprootMission({
  challenge,
  hint,
  attemptsLeft,
  submitting,
  disabled,
  onSubmit,
}: MissionComponentProps) {
  const c = asRecord(challenge);
  const internalKey = str(c.internalKey);
  const question = str(c.question);
  const scriptPaths = listOf(c.scriptPaths).map((p) => str(p));
  const candidates = listOf(c.candidates).map((k) => str(asRecord(k).key));

  const [choice, setChoice] = useState<number | null>(null);
  const [path, setPath] = useState<"key" | "script" | null>(null);

  const answer = choice !== null && path !== null ? { choice, path } : null;

  return (
    <MissionFrame
      hint={hint}
      answer={answer}
      attemptsLeft={attemptsLeft}
      submitting={submitting}
      disabled={disabled}
      onSubmit={onSubmit}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Clé interne</span>
          <code className="block break-all rounded-lg border bg-background px-3 py-2 font-mono text-xs">
            {internalKey}
          </code>
        </div>

        <p className="text-sm font-medium leading-relaxed">{question}</p>

        <div className="space-y-2">
          <Label>Sortie P2TR candidate</Label>
          <RadioGroup
            className="space-y-2"
            value={choice !== null ? String(choice) : ""}
            onValueChange={(v) => setChoice(Number(v))}
            disabled={submitting || disabled}
          >
            {candidates.map((key, i) => (
              <Label
                key={key}
                htmlFor={`bq-taproot-${i}`}
                className={cn(
                  "min-h-10 cursor-pointer items-center justify-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  choice === i ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40",
                )}
              >
                <RadioGroupItem id={`bq-taproot-${i}`} value={String(i)} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Sortie {i + 1}</span>
                  <code className="block truncate font-mono text-[11px] text-muted-foreground" title={key}>
                    {key.slice(0, 24)}…{key.slice(-8)}
                  </code>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Chemin de dépense</Label>
          <RadioGroup
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            value={path ?? ""}
            onValueChange={(v) => setPath(v as "key" | "script")}
            disabled={submitting || disabled}
          >
            <Label
              htmlFor="bq-path-key"
              className={cn(
                "min-h-10 cursor-pointer items-center justify-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                path === "key" ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40",
              )}
            >
              <RadioGroupItem id="bq-path-key" value="key" />
              <span className="min-w-0">
                <span className="block font-medium">Key path (signature Schnorr)</span>
                <span className="block text-[11px] text-muted-foreground">
                  Dépense directe sur la clé tweakée
                </span>
              </span>
            </Label>
            <Label
              htmlFor="bq-path-script"
              className={cn(
                "min-h-10 cursor-pointer items-center justify-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                path === "script" ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40",
              )}
            >
              <RadioGroupItem id="bq-path-script" value="script" />
              <span className="min-w-0">
                <span className="block font-medium">Script path</span>
                <span className="block text-[11px] text-muted-foreground">
                  Chemins alternatifs{scriptPaths.length > 0 ? ` : ${scriptPaths.join(", ")}` : ""}
                </span>
              </span>
            </Label>
          </RadioGroup>
        </div>
      </div>
    </MissionFrame>
  );
}

function UnknownMission({ challenge }: { challenge: Record<string, unknown> }) {
  return (
    <Alert variant="destructive">
      <CircleAlert className="h-4 w-4" />
      <AlertTitle>Type de mission inconnu</AlertTitle>
      <AlertDescription>
        BitLab ne reconnaît pas cet exercice. Reviens à la carte et relance la quête.
        <code className="mt-2 block max-h-32 overflow-y-auto break-all font-mono text-[11px]">
          {JSON.stringify(challenge)}
        </code>
      </AlertDescription>
    </Alert>
  );
}

/* ============ Panneau principal ============ */

export function MissionPanel(props: MissionPanelProps) {
  const { missionType, challenge, brief, hint, attemptsLeft, submitting, lastFeedback, onSubmit, disabled } =
    props;

  const missionProps: MissionComponentProps = {
    challenge,
    hint,
    attemptsLeft,
    submitting,
    disabled,
    onSubmit,
  };
  const txVariant = str(asRecord(challenge).variant, "payment");

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {/* En-tête terminal */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          BitLab Sandbox · Testnet connecté
        </span>
        <Badge variant="outline" className="ml-auto shrink-0 border-emerald-500/40 text-emerald-500">
          Exercice guidé
        </Badge>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {brief && (
          <Alert>
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <AlertTitle>Mission :</AlertTitle>
            <AlertDescription>{brief}</AlertDescription>
          </Alert>
        )}

        {missionType === "block_explorer" && <BlockExplorerMission {...missionProps} />}
        {missionType === "key_forge" && <KeyForgeMission {...missionProps} />}
        {missionType === "tx_builder" && txVariant === "fee_opt" && <FeeOptMission {...missionProps} />}
        {missionType === "tx_builder" && txVariant !== "fee_opt" && <TxBuilderMission {...missionProps} />}
        {missionType === "mine_nonce" && <MineNonceMission {...missionProps} />}
        {missionType === "ln_channel" && <LnChannelMission {...missionProps} />}
        {missionType === "ln_invoice" && <LnInvoiceMission {...missionProps} />}
        {missionType === "multisig_sign" && <MultisigMission {...missionProps} />}
        {missionType === "taproot_tweak" && <TaprootMission {...missionProps} />}
        {![
          "block_explorer",
          "key_forge",
          "tx_builder",
          "mine_nonce",
          "ln_channel",
          "ln_invoice",
          "multisig_sign",
          "taproot_tweak",
        ].includes(missionType) && <UnknownMission challenge={challenge} />}

        {lastFeedback && !lastFeedback.success && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Soumission refusée par BitLab</AlertTitle>
            <AlertDescription>
              {lastFeedback.feedback}
              <span className="mt-1 block font-medium">
                Tentatives restantes : {Math.max(0, attemptsLeft)}
              </span>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
}
