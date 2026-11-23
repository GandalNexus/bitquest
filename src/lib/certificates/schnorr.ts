import { createHash, createHmac } from "node:crypto";
import * as secp from "@noble/secp256k1";

/**
 * Signature Schnorr-secp256k1 (BIP-340) pour Certificate v2 (LOT 71).
 *
 * V1 utilise HMAC-SHA256 symétrique (seul le serveur peut vérifier).
 * V2 utilise Schnorr-secp256k1 : la clé publique peut être publiée
 * (cf. NIP-11 Nostr ou /api/version) et n'importe quel client peut
 * vérifier offline.
 *
 * Secret :
 *   - `CERT_SIGN_PRIVKEY_HEX` env : 32 octets hex (64 chars).
 *   - En prod si absent → throw.
 *   - En dev si absent → clé déterministe `"dev"` répétée (jamais en
 *     prod — c'est documenté dans CERTIFICATES_V2 §Secret).
 *
 * Format signé : `v2.<payloadB64url>.<sig64hex>`
 *   - `v2` : literal.
 *   - `<payload>` : JSON canonicalisé (clés triées), base64url.
 *   - `<sig>` : signature Schnorr 64 octets en hex (128 chars).
 */

/* ============================================================
 * Hashes : @noble/secp256k1 v3 exige qu'on injecte sha256 et
 * hmac-sha256 car il est modulaire (pas de dépendance crypto).
 * On branche sur node:crypto en server-side.
 * ============================================================ */
let hashesInjected = false;
function ensureHashes(): void {
  if (hashesInjected) return;
  secp.hashes.sha256 = (msg) => createHash("sha256").update(msg).digest();
  secp.hashes.sha256Async = async (msg) =>
    createHash("sha256").update(msg).digest();
  secp.hashes.hmacSha256 = (key, msg) =>
    createHmac("sha256", key).update(msg).digest();
  secp.hashes.hmacSha256Async = async (key, msg) =>
    createHmac("sha256", key).update(msg).digest();
  hashesInjected = true;
}

/* ============================================================
 * Clé privée de signature.
 * ============================================================ */
const DEV_FALLBACK_PRIVKEY_HEX =
  "6465766465766465766465766465766465766465766465766465766465766465"; // "devdev…" 32B

function getPrivateKeyBytes(): Uint8Array {
  const raw = process.env.CERT_SIGN_PRIVKEY_HEX?.trim() ?? "";
  const hex = /^[0-9a-f]{64}$/i.test(raw) ? raw : "";
  if (!hex) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CERT_SIGN_PRIVKEY_HEX requis en production (64 hex chars).",
      );
    }
    return hexToBytes(DEV_FALLBACK_PRIVKEY_HEX);
  }
  return hexToBytes(hex);
}

/** Expose la clé publique x-only (BIP-340, 32B hex) de l'instance. */
export function getInstancePublicKeyHex(): string {
  ensureHashes();
  const priv = getPrivateKeyBytes();
  const pub = secp.schnorr.getPublicKey(priv);
  return bytesToHex(pub);
}

/** `true` si une vraie clé Schnorr (non dev-fallback) est configurée. */
export function hasInstanceSchnorrKey(): boolean {
  const raw = process.env.CERT_SIGN_PRIVKEY_HEX?.trim() ?? "";
  return /^[0-9a-f]{64}$/i.test(raw);
}

/* ============================================================
 * Helpers encoding.
 * ============================================================ */
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/* ============================================================
 * Canonical payload = clés niveau 1 triées, puis JSON.stringify.
 * ============================================================ */
function canonicalize(payload: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}

/* ============================================================
 * API : sign + verify Schnorr v2.
 * ============================================================ */

/**
 * Signe un payload en v2 Schnorr. Retourne la chaîne
 * `v2.<payloadB64url>.<sig64hex>`.
 */
export async function signCertificateSchnorr(
  payload: Record<string, unknown>,
): Promise<string> {
  ensureHashes();
  const canonical = canonicalize(payload);
  const payloadB64 = b64urlEncode(Buffer.from(canonical));
  const msg = new TextEncoder().encode(payloadB64);
  const priv = getPrivateKeyBytes();
  const sig = await secp.schnorr.sign(msg, priv);
  return `v2.${payloadB64}.${bytesToHex(sig)}`;
}

/**
 * Vérifie un blob v2. Retourne le payload décodé, ou jette si
 * signature/format invalide.
 */
export async function verifyCertificateSchnorr(
  blob: string,
): Promise<Record<string, unknown>> {
  ensureHashes();
  const parts = blob.split(".");
  if (parts.length !== 3) throw new Error("Format certificat v2 invalide.");
  const [version, payloadB64, sigHex] = parts;
  if (version !== "v2") throw new Error(`Version ${version} non supportée.`);
  if (!/^[0-9a-f]{128}$/i.test(sigHex)) {
    throw new Error("Signature v2 malformée (128 hex attendus).");
  }

  const priv = getPrivateKeyBytes();
  const pub = secp.schnorr.getPublicKey(priv);
  const msg = new TextEncoder().encode(payloadB64);
  const sigBytes = hexToBytes(sigHex);
  const valid = await secp.schnorr.verify(sigBytes, msg, pub);
  if (!valid) throw new Error("Signature v2 invalide.");

  const json = b64urlDecode(payloadB64).toString("utf8");
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Payload v2 malformé.");
  }
  return parsed as Record<string, unknown>;
}

/**
 * Vérifie un blob Schnorr v2 avec une clé publique fournie
 * (cas d'un vérificateur offline qui a récupéré la pubkey via
 * `/api/version` ou NIP-11). Utilisée principalement pour les
 * tests ; en prod l'endpoint `/api/certificates/verify` utilise
 * `verifyCertificateSchnorr` qui ressort la clé serveur.
 */
export async function verifyCertificateSchnorrWithPubkey(
  blob: string,
  pubkeyHex: string,
): Promise<Record<string, unknown>> {
  ensureHashes();
  const parts = blob.split(".");
  if (parts.length !== 3) throw new Error("Format certificat v2 invalide.");
  const [version, payloadB64, sigHex] = parts;
  if (version !== "v2") throw new Error(`Version ${version} non supportée.`);
  if (!/^[0-9a-f]{64}$/i.test(pubkeyHex)) {
    throw new Error("Pubkey Schnorr invalide (64 hex attendus).");
  }
  if (!/^[0-9a-f]{128}$/i.test(sigHex)) {
    throw new Error("Signature v2 malformée.");
  }
  const msg = new TextEncoder().encode(payloadB64);
  const valid = await secp.schnorr.verify(
    hexToBytes(sigHex),
    msg,
    hexToBytes(pubkeyHex),
  );
  if (!valid) throw new Error("Signature v2 invalide pour cette pubkey.");
  const json = b64urlDecode(payloadB64).toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}
