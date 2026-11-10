import { logger } from "@/lib/log";

const log = logger("mempool");

/* ============================================================
 * MempoolClient — Phase 3 foundation.
 *
 * Client minimal pour mempool.space et son fallback blockstream.info.
 * On expose uniquement les endpoints nécessaires à la vérification de
 * preuve d'une mission BitLab : lookup d'une tx + lookup d'un bloc.
 *
 * Volontairement simple : fetch natif, timeout court, fallback explicite.
 * Pas de cache (Redis + ETag viendront si besoin).
 * ============================================================ */

export type Network = "testnet4" | "signet" | "regtest" | "mainnet";

export interface TxInfo {
  txid: string;
  confirmed: boolean;
  blockHeight: number | null;
  blockHash: string | null;
  feeSats: number;
  size: number;
  vout: { scriptpubkey_address?: string; value: number }[];
}

export interface BlockInfo {
  id: string; // hash
  height: number;
  timestamp: number;
  tx_count: number;
  miner?: string;
}

/** Base URLs par réseau. mainnet est listé pour complétude mais BitQuest ne doit JAMAIS l'utiliser v1. */
const BASES: Record<Network, { mempool: string; blockstream: string }> = {
  mainnet: {
    mempool: "https://mempool.space/api",
    blockstream: "https://blockstream.info/api",
  },
  testnet4: {
    mempool: "https://mempool.space/testnet4/api",
    blockstream: "https://blockstream.info/testnet/api",
  },
  signet: {
    mempool: "https://mempool.space/signet/api",
    blockstream: "https://blockstream.info/signet/api",
  },
  regtest: {
    // Pas de public API ; usage local attendu via MEMPOOL_API_URL env override.
    mempool: process.env.MEMPOOL_API_URL ?? "http://localhost:8080/api",
    blockstream: process.env.MEMPOOL_API_URL ?? "http://localhost:8080/api",
  },
};

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

async function tryGet<T>(primaryUrl: string, fallbackUrl: string): Promise<T> {
  try {
    const res = await fetchWithTimeout(primaryUrl);
    if (res.ok) return (await res.json()) as T;
    throw new Error(`mempool.space ${res.status}`);
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err), primaryUrl, fallbackUrl },
      "primary mempool failed, trying fallback",
    );
    const res = await fetchWithTimeout(fallbackUrl);
    if (!res.ok) throw new Error(`fallback ${res.status} on ${fallbackUrl}`);
    return (await res.json()) as T;
  }
}

/**
 * Récupère les infos d'une transaction. Retourne null si introuvable (404).
 * Les deux explorateurs ont des shapes similaires — on normalise les champs
 * utiles ici pour minimiser le couplage côté validation de preuve.
 */
export async function getTransaction(network: Network, txid: string): Promise<TxInfo | null> {
  if (network === "mainnet") {
    throw new Error("mainnet is intentionally unsupported in BitQuest v1");
  }
  const { mempool, blockstream } = BASES[network];
  try {
    const raw = await tryGet<{
      txid: string;
      status: { confirmed: boolean; block_height?: number; block_hash?: string };
      fee: number;
      size: number;
      vout: { scriptpubkey_address?: string; value: number }[];
    }>(`${mempool}/tx/${txid}`, `${blockstream}/tx/${txid}`);
    return {
      txid: raw.txid,
      confirmed: raw.status.confirmed,
      blockHeight: raw.status.block_height ?? null,
      blockHash: raw.status.block_hash ?? null,
      feeSats: raw.fee,
      size: raw.size,
      vout: raw.vout,
    };
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err), txid }, "tx lookup failed");
    return null;
  }
}

/** Récupère les infos d'un bloc par hash. Retourne null si introuvable. */
export async function getBlock(network: Network, hash: string): Promise<BlockInfo | null> {
  if (network === "mainnet") {
    throw new Error("mainnet is intentionally unsupported in BitQuest v1");
  }
  const { mempool, blockstream } = BASES[network];
  try {
    const raw = await tryGet<{
      id: string;
      height: number;
      timestamp: number;
      tx_count: number;
      extras?: { pool?: { name?: string } };
    }>(`${mempool}/block/${hash}`, `${blockstream}/block/${hash}`);
    return {
      id: raw.id,
      height: raw.height,
      timestamp: raw.timestamp,
      tx_count: raw.tx_count,
      miner: raw.extras?.pool?.name,
    };
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err), hash }, "block lookup failed");
    return null;
  }
}
