import { PROTOCOL_VERSION } from "./protocol";

/**
 * Wrapper autour de `Response.json` qui ajoute `X-Protocol-Version` et
 * `X-Certificate-Version` sur les réponses des routes BitLab/
 * certificates publiques (LOT 42).
 *
 * Permet aux clients tiers (BitLab, relay Nostr future, portfolio
 * verifier) de détecter la version supportée sans parser le payload.
 *
 * Ces headers sont lecture seule — le serveur ne les lit pas en
 * entrée (le `v` reste dans le payload JWT / HMAC signé).
 */
export function jsonWithProtocolVersion(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("X-Protocol-Version", String(PROTOCOL_VERSION));
  headers.set("X-Certificate-Version", "1");
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...Object.fromEntries(headers), "Content-Type": "application/json" },
  });
}
