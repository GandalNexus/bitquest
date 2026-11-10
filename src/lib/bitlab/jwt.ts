import { SignJWT, jwtVerify } from "jose";
import { getRedis } from "@/lib/cache/redis";
import { logger } from "@/lib/log";

const log = logger("bitlab-jwt");

/* ============================================================
 * JWT challenge/nonce — Phase 3 BitLab.
 *
 * Flow :
 *   1. POST /api/bitlab/challenge émet un JWT HS256 avec payload :
 *      { userId, questCode, kind, nonce, exp (1h) }
 *   2. L'apprenant va résoudre la mission dans BitLab.
 *   3. POST /api/bitlab/proof présente le JWT + la preuve. Le serveur :
 *      - vérifie la signature + expiry
 *      - vérifie que le nonce n'a pas déjà été consommé (Redis SETEX)
 *      - vérifie que la paire (userId, questCode, kind) correspond au JWT
 *      - marque le nonce comme consommé
 *
 * Secret : BITLAB_JWT_SECRET en env (fallback CSRF_SECRET pour éviter
 * de dupliquer en dev). En prod, exiger une rotation annuelle.
 * ============================================================ */

const DEFAULT_TTL_SECONDS = 60 * 60; // 1 heure

export interface ChallengePayload {
  userId: string;
  questCode: string;
  kind: string;
  nonce: string;
}

export interface ChallengeClaims extends ChallengePayload {
  iat: number;
  exp: number;
}

function getSecretBytes(): Uint8Array {
  const secret =
    process.env.BITLAB_JWT_SECRET ??
    process.env.CSRF_SECRET ??
    (process.env.NODE_ENV === "production"
      ? ""
      : "bitquest-dev-insecure-bitlab-secret");
  if (!secret) {
    throw new Error("BITLAB_JWT_SECRET (ou CSRF_SECRET) est requis en production.");
  }
  return new TextEncoder().encode(secret);
}

function randomNonce(): string {
  // 128 bits, base64url, 22 chars sans padding.
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Buffer.from(buf).toString("base64url");
}

/** Signe un JWT challenge. Expire dans `ttlSeconds` secondes. */
export async function issueChallenge(
  payload: ChallengePayload,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("bitquest")
    .setAudience("bitlab")
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getSecretBytes());

  log.info(
    { userId: payload.userId, questCode: payload.questCode, kind: payload.kind, exp },
    "bitlab challenge issued",
  );
  return { token, expiresAt: new Date(exp * 1000) };
}

/**
 * Vérifie la signature + expiry + unicité du nonce (via Redis si dispo).
 *
 * - Sans Redis : la vérif d'unicité est no-op. Risque de replay en dev
 *   mono-instance acceptable, documenté.
 * - Retourne les claims décodés en cas de succès.
 */
export async function verifyChallenge(token: string): Promise<ChallengeClaims> {
  const { payload } = await jwtVerify(token, getSecretBytes(), {
    issuer: "bitquest",
    audience: "bitlab",
  });

  const claims = payload as unknown as ChallengeClaims;
  if (!claims.userId || !claims.questCode || !claims.kind || !claims.nonce) {
    throw new Error("JWT bitlab : claims incomplètes.");
  }

  const redis = await getRedis();
  if (redis) {
    const key = `bitlab:nonce:${claims.nonce}`;
    // SETNX + EXPIRE combinés via SET ... NX EX : atomique, race-safe.
    const result = await redis.set(key, claims.userId, "EX", DEFAULT_TTL_SECONDS, "NX");
    if (result === null) {
      throw new Error("Nonce BitLab déjà consommé (replay bloqué).");
    }
  } else {
    log.warn({ nonce: claims.nonce }, "redis indisponible : anti-replay désactivé en dev");
  }

  return claims;
}

/** Helper pour les handlers. Retourne une Response 400 formatée en cas d'erreur. */
export async function verifyChallengeOrRespond(
  token: string,
): Promise<{ ok: true; claims: ChallengeClaims } | { ok: false; response: Response }> {
  try {
    const claims = await verifyChallenge(token);
    return { ok: true, claims };
  } catch (err) {
    const message = err instanceof Error ? err.message : "JWT bitlab invalide.";
    return {
      ok: false,
      response: Response.json({ error: message }, { status: 400 }),
    };
  }
}

export function freshNonce(): string {
  return randomNonce();
}
