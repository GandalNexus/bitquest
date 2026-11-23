// eslint-disable-next-line @typescript-eslint/no-require-imports
const bolt11Lib = require("bolt11") as {
  decode: (invoice: string) => DecodedInvoiceRaw;
};
import { logger } from "@/lib/log";

const log = logger("bolt11");

/* ============================================================
 * BOLT11 decoder — Phase 3 BitLab.
 *
 * Wrapper mince autour de la lib `bolt11` npm pour exposer une API
 * stable à nos handlers : on ne garde que les champs utiles côté
 * verification de preuve (amount, expiry, network, hash).
 *
 * Validation stricte :
 *   - exige testnet / signet (refuse mainnet explicitement)
 *   - exige amountMsat > 0 ou amount présent
 *   - timing expiration non enforced ici — on retourne les valeurs,
 *     le handler décide (une invoice expirée peut être valide dans
 *     certains contextes pédagogiques)
 * ============================================================ */

interface Bolt11Tag {
  tagName: string;
  data: unknown;
}

interface DecodedInvoiceRaw {
  paymentRequest: string;
  prefix: string; // lntb, lnbs, lnbcrt, lnbc…
  wordsTemp: string;
  complete: boolean;
  millisatoshis: string | null;
  satoshis: number | null;
  timestamp: number;
  timestampString: string;
  payeeNodeKey: string;
  signature: string;
  recoveryFlag: number;
  tags: Bolt11Tag[];
}

export interface DecodedInvoice {
  amountSats: number | null;
  amountMsat: number | null;
  network: "testnet" | "signet" | "regtest" | "mainnet";
  timestamp: number;
  expiry: number; // secondes depuis timestamp (défaut BOLT11 = 3600)
  paymentHash: string | null;
  description: string | null;
  payeeNodeKey: string;
}

/** Prefix → réseau. `lntb` = testnet, `lnbs` = signet, `lnbcrt` = regtest, `lnbc` = mainnet. */
function prefixToNetwork(prefix: string): DecodedInvoice["network"] {
  const p = prefix.toLowerCase();
  if (p.startsWith("lntb")) return "testnet";
  if (p.startsWith("lnbs")) return "signet";
  if (p.startsWith("lnbcrt")) return "regtest";
  if (p.startsWith("lnbc")) return "mainnet";
  return "mainnet"; // défaut safe : refusé ensuite
}

/** Extrait un tag BOLT11 par nom. */
function findTag(tags: Bolt11Tag[], name: string): unknown {
  return tags.find((t) => t.tagName === name)?.data;
}

/**
 * Décode une invoice BOLT11 et retourne une forme normalisée.
 * Jette si l'invoice est mal formée ou pointe vers mainnet.
 */
export function decodeInvoice(invoice: string): DecodedInvoice {
  let raw: DecodedInvoiceRaw;
  try {
    raw = bolt11Lib.decode(invoice);
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "bolt11 decode failed");
    throw new Error("Invoice BOLT11 mal formée.");
  }

  const network = prefixToNetwork(raw.prefix);
  if (network === "mainnet") {
    throw new Error("BitQuest refuse les invoices mainnet (v1 pédagogique uniquement).");
  }

  const amountSats = typeof raw.satoshis === "number" ? raw.satoshis : null;
  const amountMsat = raw.millisatoshis ? Number(raw.millisatoshis) : null;

  const paymentHashRaw = findTag(raw.tags, "payment_hash");
  const descriptionRaw = findTag(raw.tags, "description");
  const expiryRaw = findTag(raw.tags, "expire_time");

  return {
    amountSats,
    amountMsat,
    network,
    timestamp: raw.timestamp,
    expiry: typeof expiryRaw === "number" ? expiryRaw : 3600,
    paymentHash: typeof paymentHashRaw === "string" ? paymentHashRaw : null,
    description: typeof descriptionRaw === "string" ? descriptionRaw : null,
    payeeNodeKey: raw.payeeNodeKey,
  };
}
