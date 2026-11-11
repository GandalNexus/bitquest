import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { logger } from "@/lib/log";
import type { ChannelInfo } from "./lightning";

const log = logger("lnd");

/* ============================================================
 * LndClient — Phase 3 BitLab, couverture Lightning testnet/signet/regtest.
 *
 * Interroge le REST de LND (`/v1/graph/edge/{chan_id}`) pour vérifier
 * l'existence d'un channel. L'opérateur fait tourner son propre node
 * (voir docs/PHASE_3_BITLAB.md § LND) et fournit via env :
 *   - LND_REST_URL          : https://<host>:8080
 *   - LND_MACAROON_HEX      : macaroon admin ou read-only (hex)
 *   - LND_TLS_INSECURE=1    : ignore le cert self-signed en dev
 *
 * Portée volontairement minimale : pas de abonnement gRPC, pas de
 * routing hints. Juste lecture d'un edge pour valider une preuve.
 * ============================================================ */

export interface LndConfig {
  url: string;
  macaroonHex: string;
  tlsInsecure: boolean;
}

export function getLndConfig(): LndConfig | null {
  const url = process.env.LND_REST_URL?.trim();
  const macaroonHex = process.env.LND_MACAROON_HEX?.trim();
  if (!url || !macaroonHex) return null;
  return {
    url,
    macaroonHex,
    tlsInsecure: process.env.LND_TLS_INSECURE === "1",
  };
}

/** Teste si la string est un chan_id LND (uint64 décimal). */
export function isChanId(value: string): boolean {
  return /^\d{10,24}$/.test(value.trim());
}

/**
 * Convertit un short channel ID (`<block>x<tx>x<vout>`) vers le chan_id
 * uint64 attendu par LND (`(block << 40) | (tx << 16) | vout`).
 * Jette si le format est invalide.
 */
export function scidToChanId(scid: string): string {
  const parts = scid.trim().split("x");
  if (parts.length !== 3) {
    throw new Error("scid doit avoir 3 composantes <block>x<tx>x<vout>");
  }
  const [b, t, v] = parts;
  if (!/^\d+$/.test(b) || !/^\d+$/.test(t) || !/^\d+$/.test(v)) {
    throw new Error("scid : composantes non numériques");
  }
  const block = BigInt(b);
  const tx = BigInt(t);
  const vout = BigInt(v);
  const ZERO = BigInt(0);
  if (block < ZERO || tx < ZERO || vout < ZERO) {
    throw new Error("scid : composantes négatives");
  }
  return ((block << BigInt(40)) | (tx << BigInt(16)) | vout).toString(10);
}

/* --------- Mapping réponse LND → ChannelInfo --------- */

export interface LndEdgeResponse {
  channel_id?: string | number;
  chan_point?: string;
  capacity?: string | number;
  node1_pub?: string;
  node2_pub?: string;
}

export function mapLndChannel(raw: LndEdgeResponse, fallbackId: string): ChannelInfo {
  const chanPoint = typeof raw.chan_point === "string" ? raw.chan_point.split(":") : null;
  const txid = chanPoint && chanPoint[0] ? chanPoint[0] : null;
  const vout = chanPoint && chanPoint[1] !== undefined ? Number(chanPoint[1]) : null;
  return {
    id: raw.channel_id !== undefined ? String(raw.channel_id) : fallbackId,
    shortId: null,
    capacity: Number(raw.capacity ?? 0),
    status: "active",
    transactionId: txid,
    transactionVout: Number.isFinite(vout) ? vout : null,
    nodeLeftPub: raw.node1_pub ?? null,
    nodeRightPub: raw.node2_pub ?? null,
  };
}

/* --------- Requête HTTP (testable via vi.mock sur node:https) --------- */

const DEFAULT_TIMEOUT_MS = 5_000;

interface HttpResult {
  status: number;
  body: unknown;
}

function requestJson(
  cfg: LndConfig,
  path: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(path, cfg.url);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const isHttps = parsed.protocol === "https:";
    const req = (isHttps ? httpsRequest : httpRequest)(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "Grpc-Metadata-macaroon": cfg.macaroonHex,
          Accept: "application/json",
        },
        ...(isHttps ? { rejectUnauthorized: !cfg.tlsInsecure } : {}),
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: unknown = null;
          try {
            body = text.length > 0 ? JSON.parse(text) : null;
          } catch {
            body = null;
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("lnd request timeout")));
    req.on("error", reject);
    req.end();
  });
}

/**
 * Récupère un channel via LND REST. Retourne null si introuvable ou
 * si le node répond autrement qu'avec un 200.
 */
export async function getChannelViaLnd(
  identifier: string,
  cfg: LndConfig,
): Promise<ChannelInfo | null> {
  const id = identifier.trim();
  let chanId: string;
  try {
    chanId = /^\d+x\d+x\d+$/.test(id) ? scidToChanId(id) : id;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err), id }, "lnd: scid invalide");
    return null;
  }
  if (!isChanId(chanId)) {
    log.warn({ id, chanId }, "lnd: chan_id invalide");
    return null;
  }
  try {
    const { status, body } = await requestJson(cfg, `/v1/graph/edge/${chanId}`);
    if (status !== 200 || !body || typeof body !== "object") {
      log.warn({ status, chanId }, "lnd channel lookup non-200");
      return null;
    }
    return mapLndChannel(body as LndEdgeResponse, chanId);
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err), chanId },
      "lnd channel lookup failed",
    );
    return null;
  }
}
