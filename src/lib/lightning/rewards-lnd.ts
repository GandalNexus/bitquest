import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import type { LndConfig } from "@/lib/bitlab/lnd";

/* ============================================================
 * Couche wire LND pour `sendReward` — POST /v2/router/send (sync,
 * no_inflight_updates). Isolé dans son propre module pour permettre
 * aux tests de `sendReward` de mocker ce fichier via `vi.mock()` sans
 * toucher à `node:https` global (Prisma / Vitest internals en
 * dépendent).
 * ============================================================ */

export const LND_PAY_TIMEOUT_MS = 30_000;

export interface LndRouterResult {
  status: number;
  body: unknown;
}

export function lndRouterSend(cfg: LndConfig, invoice: string): Promise<LndRouterResult> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL("/v2/router/send", cfg.url);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const isHttps = parsed.protocol === "https:";
    const payload = JSON.stringify({
      payment_request: invoice,
      timeout_seconds: 25,
      no_inflight_updates: true,
    });
    const tlsOpts: Record<string, unknown> = {};
    if (isHttps) {
      if (cfg.tlsCa) {
        tlsOpts.ca = cfg.tlsCa;
        tlsOpts.rejectUnauthorized = true;
      } else {
        tlsOpts.rejectUnauthorized = !cfg.tlsInsecure;
      }
    }
    const req = (isHttps ? httpsRequest : httpRequest)(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname,
        method: "POST",
        headers: {
          "Grpc-Metadata-macaroon": cfg.macaroonHex,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload).toString(),
          Accept: "application/json",
        },
        ...tlsOpts,
        timeout: LND_PAY_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: unknown = null;
          try {
            body = text.length > 0 ? JSON.parse(text.trim().split("\n")[0]) : null;
          } catch {
            body = null;
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("TIMEOUT")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
