import { createHmac, timingSafeEqual } from "node:crypto";
import { PROTOCOL_VERSION } from "./protocol";

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
 *
 * Signature HMAC optionnelle : quand BITLAB_SIGN_SECRET est configuré,
 * BitQuest signe (v|userId|questCode|kind|network|ts) et attache
 * `sig=<base64url>` + `ts=<unix>` + `v=<version>` à la deep-link.
 * BitLab échoe ces params inchangés à la redirection de retour. Côté
 * réception, BitQuest vérifie la signature + l'âge (max 1h) + la
 * version. Si le secret n'est pas configuré, le flux est inchangé
 * (signature optionnelle).
 *
 * Versionnement (P0.3) :
 *   - Format canonique v1 : `${v}|${userId}|${questCode}|${kind}|${network}|${ts}`.
 *   - Format legacy (sans v) : `${userId}|${questCode}|${kind}|${network}|${ts}`.
 *   - À l'émission : toujours v1.
 *   - À la vérification : essaie v1 puis fallback legacy si `v` est absent
 *     côté params reçus. Les URLs émises avant le bump restent valides
 *     jusqu'à expiration naturelle (TTL 1h).
 */

export type BitlabDeepLinkKind = "TX" | "BLOCK" | "INVOICE" | "CHANNEL" | "ADDRESS";

const MAX_SIG_AGE_SECONDS = 60 * 60;

interface CanonicalArgs {
  userId: string;
  questCode: string;
  kind: BitlabDeepLinkKind;
  network: string;
  ts: number;
  v?: number;
}

/**
 * Format canonique du payload à signer.
 * - v1 : `${v}|${userId}|${questCode}|${kind}|${network}|${ts}`
 * - legacy (v omis) : `${userId}|${questCode}|${kind}|${network}|${ts}`
 */
function canonical(args: CanonicalArgs): string {
  const base = `${args.userId}|${args.questCode}|${args.kind}|${args.network}|${args.ts}`;
  return args.v === undefined ? base : `${args.v}|${base}`;
}

/**
 * Calcule la signature HMAC-SHA256 base64url du payload canonique.
 * Par défaut, émet au format `v: PROTOCOL_VERSION`. Pour émettre un
 * payload legacy (tests de compat), passer explicitement `v: undefined`.
 */
export function signDeepLinkPayload(args: {
  userId: string;
  questCode: string;
  kind: BitlabDeepLinkKind;
  network: string;
  ts: number;
  secret: string;
  /** Version du protocole. Default: PROTOCOL_VERSION courant. */
  v?: number;
}): string {
  const v = "v" in args ? args.v : PROTOCOL_VERSION;
  return createHmac("sha256", args.secret)
    .update(canonical({ ...args, v }))
    .digest("base64url");
}

function compareSignatures(expectedBase64url: string, providedBase64url: string): boolean {
  let expectedBuf: Buffer;
  let providedBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expectedBase64url, "base64url");
    providedBuf = Buffer.from(providedBase64url, "base64url");
  } catch {
    return false;
  }
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Vérifie une signature deep-link. Retourne true si la signature est
 * valide ET l'âge inférieur à `MAX_SIG_AGE_SECONDS` ET la version du
 * protocole compatible. Utilise `timingSafeEqual` pour éviter les
 * timing attacks.
 *
 * Résolution de la version :
 *   - `v` fourni dans args → vérifie strictement avec cette version
 *     (rejet si `v > PROTOCOL_VERSION`, `v < 1` ou non-entier).
 *   - `v` absent → essaie d'abord le format `PROTOCOL_VERSION` courant,
 *     puis fallback legacy (payload canonique sans préfixe `v`).
 *     Permet la transition pendant la fenêtre d'expiration des URLs
 *     émises avant l'introduction du champ.
 */
export function verifyDeepLinkPayload(args: {
  userId: string;
  questCode: string;
  kind: BitlabDeepLinkKind;
  network: string;
  ts: number;
  sig: string;
  secret: string;
  nowMs?: number;
  /** Version lue depuis l'URL/payload. Si absente, essaie courant puis legacy. */
  v?: number;
}): boolean {
  const now = args.nowMs ?? Date.now();
  const ageSeconds = Math.floor((now - args.ts * 1000) / 1000);
  if (ageSeconds < 0 || ageSeconds > MAX_SIG_AGE_SECONDS) return false;

  const tryWith = (v: number | undefined): boolean => {
    const expected = signDeepLinkPayload({
      userId: args.userId,
      questCode: args.questCode,
      kind: args.kind,
      network: args.network,
      ts: args.ts,
      secret: args.secret,
      v,
    });
    return compareSignatures(expected, args.sig);
  };

  if (args.v !== undefined) {
    if (!Number.isInteger(args.v) || args.v < 1) return false;
    if (args.v > PROTOCOL_VERSION) return false;
    return tryWith(args.v);
  }

  // `v` absent côté URL : tentative versioned courante puis fallback legacy.
  return tryWith(PROTOCOL_VERSION) || tryWith(undefined);
}

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

/** Nom du query param à lire dans le returnTo selon le kind. */
const RETURN_PARAM_BY_KIND: Record<BitlabDeepLinkKind, string> = {
  TX: "txid",
  BLOCK: "hash",
  INVOICE: "bolt11",
  CHANNEL: "scid",
  ADDRESS: "address",
};

function isValidReturnValue(kind: BitlabDeepLinkKind, raw: string): boolean {
  const value = raw.trim();
  if (value.length === 0) return false;
  switch (kind) {
    case "TX":
    case "BLOCK":
      return /^[0-9a-f]{64}$/i.test(value);
    case "INVOICE":
      return /^ln[a-z0-9]{10,}$/i.test(value);
    case "CHANNEL":
      return /^\d+x\d+x\d+$/.test(value) || /^\d{10,24}$/.test(value);
    case "ADDRESS":
      // bech32/base58 avec longueur raisonnable ; validation serveur fera foi
      return /^[a-zA-Z0-9]{10,100}$/.test(value);
  }
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
  const returnParam = RETURN_PARAM_BY_KIND[kind];
  const raw = params.get(returnParam) ?? "";
  if (!isValidReturnValue(kind, raw)) return null;
  // Normalise la casse uniquement pour les hex (txid, hash) ; les autres
  // (bolt11, scid, address) sont case-sensitive ou ont leur propre normalisation.
  const normalized =
    kind === "TX" || kind === "BLOCK" ? raw.trim().toLowerCase() : raw.trim();
  return { kind, network, value: normalized };
}
