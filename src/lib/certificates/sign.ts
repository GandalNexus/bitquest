import crypto from "crypto";

/**
 * Signature HMAC-SHA256 des certificats exportables (LOT 28).
 *
 * V1 : signature symétrique HMAC — rapide, sans dépendance externe.
 * V2+ (futur NIP/Nostr) : signature asymétrique schnorr-secp256k1 avec
 * la clé publique de l'instance BitQuest publiée en tant que NIP-11.
 *
 * Format signé : `v1.base64url(payloadJson).base64url(signature)`
 *
 * Secret (ordre de priorité) :
 *   1. `CERT_SIGN_SECRET` (dédié, recommandé en prod)
 *   2. `CSRF_SECRET` (fallback dev)
 *   3. dev-only insecure (throw en NODE_ENV=production)
 */

const PROTOCOL_VERSION = "v1" as const;

function getSecret(): Buffer {
  const dedicated = process.env.CERT_SIGN_SECRET?.trim();
  if (dedicated && dedicated.length >= 16) return Buffer.from(dedicated);
  const csrf = process.env.CSRF_SECRET?.trim();
  if (csrf && csrf.length >= 16) return Buffer.from(csrf);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CERT_SIGN_SECRET requis en production (≥ 16 caractères).",
    );
  }
  return Buffer.from("dev-cert-sign-insecure-fallback-bitquest");
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

export interface CertificatePayload {
  /** Version du protocole certif */
  v: 1;
  /** ID Prisma du Certificate (stable) */
  certificateId: string;
  /** ID de l'Attestation source */
  attestationId: string;
  /** userId du titulaire — utile pour vérifs offline */
  userId: string;
  /** Kind de l'attestation (QUEST, COURSE, BADGE_EARNED) */
  kind: string;
  /** Target code (ex: quest code) */
  targetCode: string;
  /** Titre humain (dénormalisé pour affichage offline) */
  targetTitle: string;
  /** Instant d'émission (ISO 8601) */
  issuedAt: string;
  /** Payload libre (xpEarned, satsEarned, …) */
  metadata: Record<string, unknown>;
  /** Pseudo du titulaire */
  pseudo: string;
  /** Instance BitQuest (hostname) */
  issuer: string;
}

/**
 * Sérialise + signe le payload. Le payload JSON est canonicalisé via
 * tri des clés de niveau 1 (évite les variations non détectables).
 */
export function signCertificate(payload: CertificatePayload): string {
  const canonicalized = JSON.stringify(
    Object.fromEntries(
      Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
  const payloadB64 = b64urlEncode(Buffer.from(canonicalized));
  const sig = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
  const sigB64 = b64urlEncode(sig);
  return `${PROTOCOL_VERSION}.${payloadB64}.${sigB64}`;
}

/**
 * Vérifie et décode un certificat signé. Jette si la signature ne
 * valide pas ou si le format est invalide.
 */
export function verifyCertificate(blob: string): CertificatePayload {
  const parts = blob.split(".");
  if (parts.length !== 3) throw new Error("Format certificat invalide.");
  const [version, payloadB64, sigB64] = parts;
  if (version !== PROTOCOL_VERSION) {
    throw new Error(`Version ${version} non supportée.`);
  }
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest();
  const providedSig = b64urlDecode(sigB64);
  if (
    expectedSig.length !== providedSig.length ||
    !crypto.timingSafeEqual(expectedSig, providedSig)
  ) {
    throw new Error("Signature certificat invalide.");
  }
  const json = b64urlDecode(payloadB64).toString("utf8");
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Payload certificat malformé.");
  }
  return parsed as CertificatePayload;
}
