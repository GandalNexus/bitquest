/**
 * Protocole deep-link BitQuest ↔ BitLab — Phase 3.
 *
 * Sender (BitQuest → BitLab) : ouvre BitLab avec les paramètres
 * nécessaires pour pré-cadrer la mission.
 *
 * Receiver (BitLab → BitQuest) : BitLab redirige l'apprenant vers
 * `returnTo` en appondant `bitlab_result=1&txid=<hex64>` (ou `hash=`).
 * BitQuest détecte ces params au mount, pré-remplit le formulaire,
 * puis nettoie l'URL via `router.replace(pathname)`.
 */

export type BitlabDeepLinkKind = "TX" | "BLOCK" | "INVOICE" | "CHANNEL" | "ADDRESS";

export interface DeepLinkOptions {
  /** URL de base (ex. https://bitlab.example/mission). */
  base: string;
  questCode: string;
  kind: BitlabDeepLinkKind;
  network: string;
  /** URL absolue à laquelle BitLab renvoie l'apprenant. */
  returnTo: string;
  /**
   * Paramètres additionnels (missionConfig, nonce de corrélation, …).
   * Les valeurs undefined sont ignorées.
   */
  extra?: Record<string, string | number | undefined>;
}

export function buildBitlabDeepLink(opts: DeepLinkOptions): string {
  const url = new URL(opts.base);
  url.searchParams.set("questCode", opts.questCode);
  url.searchParams.set("kind", opts.kind);
  url.searchParams.set("network", opts.network);
  url.searchParams.set("returnTo", opts.returnTo);
  if (opts.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Résultat du parsing d'un retour BitLab (`?bitlab_result=1&...`).
 * Retourne null si les params ne correspondent pas au protocole.
 */
export interface BitlabReturnPayload {
  kind: BitlabDeepLinkKind;
  network: string;
  value: string; // txid ou hash (hex64)
}

export function parseBitlabReturn(
  params: URLSearchParams,
): BitlabReturnPayload | null {
  if (params.get("bitlab_result") !== "1") return null;
  const kindRaw = params.get("kind") ?? "";
  const kind = (["TX", "BLOCK", "INVOICE", "CHANNEL", "ADDRESS"] as const).find(
    (k) => k === kindRaw,
  );
  if (!kind) return null;
  const network = params.get("network") ?? "";
  if (!network) return null;
  const value = params.get("txid") ?? params.get("hash") ?? "";
  if (!/^[0-9a-f]{64}$/i.test(value.trim())) return null;
  return { kind, network, value: value.trim().toLowerCase() };
}
