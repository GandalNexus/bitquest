import { SignJWT, jwtVerify } from "jose";
import { getRedis } from "@/lib/cache/redis";
import { logger } from "@/lib/log";
import { PROTOCOL_VERSION } from "@/lib/bitlab/protocol";

const log = logger("launch-token");

/* ============================================================
 * Launch token GandalNexus — LOT 2 (authentification unifiée).
 *
 * Résout : BitLab ne connaissait pas l'utilisateur BitQuest. Désormais,
 * BitQuest émet un JWT court (60s, single-use) qui identifie l'apprenant.
 * BitLab appelle `/api/auth/verify-launch-token` en server-to-server pour
 * obtenir le profil (pseudo, role) et peut le stocker dans son propre cookie.
 *
 * Sécurité :
 *   - Signé HS256 (BITLAB_LAUNCH_SECRET > BITLAB_JWT_SECRET > CSRF_SECRET).
 *   - TTL 60 secondes : fenêtre d'exploitation très courte.
 *   - Nonce consommé via Redis SET NX EX (anti-replay).
 *   - Versionnement `v` aligné sur le reste du protocole GandalNexus.
 *   - `aud: "bitlab-user"` ≠ `aud: "bitlab"` du mission JWT : empêche
 *     qu'un launch token soit confondu avec un challenge de preuve.
 *   - `iss: "bitquest"` : même émetteur, routage sûr côté BitLab.
 *
 * Ne pas confondre :
 *   - `bitlab/jwt.ts` → challenge de MISSION (lie user+quête+kind à une preuve).
 *   - `launch-token.ts` → identité UTILISATEUR (porte un profil minimal).
 * ============================================================ */

/**
 * TTL serré volontairement court : la fenêtre entre
 *   GET /api/bitlab/deep-link → navigateur redirige vers BitLab → BitLab
 *   POST /api/auth/verify-launch-token
 * doit tenir dans quelques secondes. 60s laisse de la marge sans ouvrir
 * la porte au replay ou au vol par referrer leak.
 */
const DEFAULT_TTL_SECONDS = 60;

export interface LaunchTokenProfile {
  userId: string;
  pseudo: string;
  role: string;
  email: string | null;
  emailVerifiedAt: Date | null;
}

export interface LaunchTokenClaims extends LaunchTokenProfile {
  nonce: string;
  iat: number;
  exp: number;
  v: number;
}

function getSecretBytes(): Uint8Array {
  const secret =
    process.env.BITLAB_LAUNCH_SECRET ??
    process.env.BITLAB_JWT_SECRET ??
    process.env.CSRF_SECRET ??
    (process.env.NODE_ENV === "production"
      ? ""
      : "bitquest-dev-insecure-launch-secret");
  if (!secret) {
    throw new Error(
      "BITLAB_LAUNCH_SECRET (ou BITLAB_JWT_SECRET, CSRF_SECRET) requis en production.",
    );
  }
  return new TextEncoder().encode(secret);
}

function randomNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Buffer.from(buf).toString("base64url");
}

/**
 * Émet un launch token signé embarquant l'identité de l'utilisateur.
 * À appeler depuis une route authentifiée uniquement.
 */
export async function issueLaunchToken(
  profile: LaunchTokenProfile,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<{ token: string; expiresAt: Date; nonce: string }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const nonce = randomNonce();
  const token = await new SignJWT({
    userId: profile.userId,
    pseudo: profile.pseudo,
    role: profile.role,
    email: profile.email,
    emailVerified: !!profile.emailVerifiedAt,
    nonce,
    v: PROTOCOL_VERSION,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("bitquest")
    .setAudience("bitlab-user")
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getSecretBytes());
  log.info(
    { userId: profile.userId, pseudo: profile.pseudo, v: PROTOCOL_VERSION, exp },
    "launch token issued",
  );
  return { token, expiresAt: new Date(exp * 1000), nonce };
}

/**
 * Vérifie un launch token et consomme son nonce. Retourne les claims
 * décodées en cas de succès. Jette une erreur sinon.
 *
 * Replay : sans Redis, l'anti-replay est désactivé (dev mono-instance),
 * documenté en log warn.
 */
export async function verifyLaunchToken(token: string): Promise<LaunchTokenClaims> {
  const { payload } = await jwtVerify(token, getSecretBytes(), {
    issuer: "bitquest",
    audience: "bitlab-user",
  });

  const claims = payload as unknown as Record<string, unknown>;
  const { userId, pseudo, role, nonce, v } = claims;
  if (
    typeof userId !== "string" ||
    typeof pseudo !== "string" ||
    typeof role !== "string" ||
    typeof nonce !== "string" ||
    typeof v !== "number"
  ) {
    throw new Error("Launch token : claims incomplètes.");
  }
  if (!Number.isInteger(v) || v < 1) {
    throw new Error("Launch token : version de protocole invalide.");
  }
  if (v > PROTOCOL_VERSION) {
    throw new Error(
      `Launch token : version non supportée (serveur: ${PROTOCOL_VERSION}, token: ${v}).`,
    );
  }

  const redis = await getRedis();
  if (redis) {
    const key = `launch:nonce:${nonce}`;
    // Fenêtre anti-replay : 10 min (couvre largement les 60s TTL du token
    // + tolère les retries clients avec backoff).
    const result = await redis.set(key, userId, "EX", 600, "NX");
    if (result === null) {
      throw new Error("Launch token déjà consommé (replay bloqué).");
    }
  } else {
    log.warn({ nonce }, "redis indisponible : anti-replay launch token désactivé");
  }

  const email = typeof claims.email === "string" ? claims.email : null;
  const emailVerifiedAt =
    claims.emailVerified === true ? new Date() : null;

  return {
    userId,
    pseudo,
    role,
    email,
    emailVerifiedAt,
    nonce,
    v,
    iat: claims.iat as number,
    exp: claims.exp as number,
  };
}

/** Helper pour les handlers : retourne la réponse d'erreur formatée. */
export async function verifyLaunchTokenOrRespond(
  token: string,
): Promise<
  | { ok: true; claims: LaunchTokenClaims }
  | { ok: false; response: Response }
> {
  try {
    const claims = await verifyLaunchToken(token);
    return { ok: true, claims };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Launch token invalide.";
    return {
      ok: false,
      response: Response.json({ error: message }, { status: 400 }),
    };
  }
}

/** Rend un `exp` serveur côté caller pour header-based TTL. */
export const LAUNCH_TOKEN_TTL_SECONDS = DEFAULT_TTL_SECONDS;

/* ============================================================
 * SESSION TOKEN GandalNexus (LOT final).
 *
 * Après consommation d'un launch_token (single-use, 60s), BitLab reçoit
 * un `sessionToken` longue durée (2h) qu'il stocke en sessionStorage et
 * utilise pour appeler les endpoints CORS user-scoped de BitQuest (ex.
 * /api/bitlab/me/attempts).
 *
 * Différences avec le launch_token :
 *   - aud: "bitlab-session" (anti-confusion cryptographique).
 *   - Pas de nonce : usage multiple autorisé.
 *   - TTL 2h : couvre une session de travail typique dans BitLab.
 *   - Pas de replay check côté serveur : la révocation passe par
 *     l'expiration naturelle.
 *
 * ⚠️ Ce token donne accès en lecture aux données user-scoped de BitQuest.
 * Il ne doit PAS être utilisé pour des mutations (ne passe pas par CSRF).
 * Les endpoints qui l'acceptent doivent être strictement GET + user-scoped.
 * ============================================================ */

const SESSION_TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2h

export interface SessionTokenClaims {
  userId: string;
  pseudo: string;
  role: string;
  iat: number;
  exp: number;
  v: number;
}

/** Émet un session token longue durée. Pas de nonce, usage multiple OK. */
export async function issueSessionToken(
  profile: Pick<LaunchTokenProfile, "userId" | "pseudo" | "role">,
  ttlSeconds: number = SESSION_TOKEN_TTL_SECONDS,
): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const token = await new SignJWT({
    userId: profile.userId,
    pseudo: profile.pseudo,
    role: profile.role,
    v: PROTOCOL_VERSION,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("bitquest")
    .setAudience("bitlab-session")
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getSecretBytes());
  log.info(
    { userId: profile.userId, pseudo: profile.pseudo, v: PROTOCOL_VERSION, exp },
    "session token issued",
  );
  return { token, expiresAt: new Date(exp * 1000) };
}

/** Vérifie un session token. Pas de nonce check (usage multiple). */
export async function verifySessionToken(token: string): Promise<SessionTokenClaims> {
  const { payload } = await jwtVerify(token, getSecretBytes(), {
    issuer: "bitquest",
    audience: "bitlab-session",
  });
  const claims = payload as unknown as Record<string, unknown>;
  const { userId, pseudo, role, v } = claims;
  if (
    typeof userId !== "string" ||
    typeof pseudo !== "string" ||
    typeof role !== "string" ||
    typeof v !== "number"
  ) {
    throw new Error("Session token : claims incomplètes.");
  }
  if (!Number.isInteger(v) || v < 1) {
    throw new Error("Session token : version invalide.");
  }
  if (v > PROTOCOL_VERSION) {
    throw new Error(
      `Session token : version non supportée (serveur: ${PROTOCOL_VERSION}, token: ${v}).`,
    );
  }
  return {
    userId,
    pseudo,
    role,
    v,
    iat: claims.iat as number,
    exp: claims.exp as number,
  };
}

/** Helper : extrait et vérifie le session token depuis Authorization: Bearer. */
export async function verifySessionFromRequest(
  req: Request,
): Promise<SessionTokenClaims | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export const SESSION_TOKEN_TTL = SESSION_TOKEN_TTL_SECONDS;
