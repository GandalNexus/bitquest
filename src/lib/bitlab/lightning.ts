import { logger } from "@/lib/log";

const log = logger("lightning");

/* ============================================================
 * LightningClient — Phase 3 (CHANNEL lookup).
 *
 * Client minimal pour mempool.space /api/v1/lightning/channels/{id}.
 *
 * Portée : récupérer métadonnées publiques d'un channel Lightning
 * (capacité, statut, pubkeys des 2 nodes) pour vérifier la preuve
 * d'une mission BITLAB_PROOF kind=CHANNEL.
 *
 * Limitation documentée : mempool.space n'indexe que mainnet pour
 * Lightning. Les réseaux testnet4/signet/regtest ne disposent pas
 * d'explorateur public fiable — un futur LND REST client pourra
 * couvrir ces cas (ouverture + vérif via node propre).
 * ============================================================ */

export interface ChannelInfo {
  id: string;
  shortId: string | null;
  capacity: number;
  status: string;
  transactionId: string | null;
  transactionVout: number | null;
  nodeLeftPub: string | null;
  nodeRightPub: string | null;
}

/** Short channel ID (`<block>x<tx>x<vout>`) ou channel ID numérique. */
export function isValidChannelIdentifier(value: string): boolean {
  const trimmed = value.trim();
  if (/^\d+x\d+x\d+$/.test(trimmed)) return true;
  if (/^\d{10,24}$/.test(trimmed)) return true;
  return false;
}

const MEMPOOL_LIGHTNING_BASE =
  process.env.MEMPOOL_LIGHTNING_API_URL ?? "https://mempool.space/api/v1/lightning";

const DEFAULT_TIMEOUT_MS = 5_000;

async function fetchWithTimeout(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

interface MempoolChannelRaw {
  id?: string | number;
  short_id?: string;
  capacity?: number;
  status?: string;
  transaction_id?: string;
  transaction_vout?: number;
  node_left?: { public_key?: string };
  node_right?: { public_key?: string };
}

/**
 * Lookup d'un channel Lightning via mempool.space.
 * Retourne null si introuvable (404) ou si l'explorateur est en erreur.
 */
export async function getChannel(identifier: string): Promise<ChannelInfo | null> {
  const id = identifier.trim();
  if (!isValidChannelIdentifier(id)) {
    throw new Error("Identifiant de channel invalide (attendu : <block>x<tx>x<vout> ou chan_id).");
  }
  const url = `${MEMPOOL_LIGHTNING_BASE}/channels/${id}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      log.warn({ status: res.status, url }, "channel lookup non-200");
      return null;
    }
    const raw = (await res.json()) as MempoolChannelRaw;
    return {
      id: String(raw.id ?? id),
      shortId: raw.short_id ?? null,
      capacity: typeof raw.capacity === "number" ? raw.capacity : 0,
      status: typeof raw.status === "string" ? raw.status : "unknown",
      transactionId: raw.transaction_id ?? null,
      transactionVout: typeof raw.transaction_vout === "number" ? raw.transaction_vout : null,
      nodeLeftPub: raw.node_left?.public_key ?? null,
      nodeRightPub: raw.node_right?.public_key ?? null,
    };
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err), url }, "channel lookup failed");
    return null;
  }
}
