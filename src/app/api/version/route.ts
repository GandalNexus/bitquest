import { PROTOCOL_VERSION } from "@/lib/bitlab/protocol";
import { jsonWithProtocolVersion } from "@/lib/bitlab/response";

/**
 * GET /api/version — endpoint public d'auto-découverte (LOT 44).
 *
 * Expose les versions de protocole + release pour permettre aux
 * clients tiers (BitLab, Nostr relay future, portfolio verifier) de :
 *   - détecter l'instance BitQuest (hostname, issuer).
 *   - vérifier la compatibilité de leur contrat (protocolVersion).
 *   - afficher le release déployé pour le support ops.
 *
 * Sécurité :
 *   - Public (pas d'auth), pas de rate-limit dédié (lecture statique).
 *   - Ne divulgue aucun secret.
 *   - Les champs sont des constantes build-time, pas de requête DB.
 */
export function GET(): Response {
  return jsonWithProtocolVersion({
    protocolVersion: PROTOCOL_VERSION,
    certificateVersion: 1,
    release: process.env.npm_package_version ?? "0.0.0",
    commitHash: process.env.BITQUEST_COMMIT_SHA ?? null,
    issuer: process.env.NEXT_PUBLIC_BITQUEST_HOST ?? "bitquest.local",
    builtAt: process.env.BITQUEST_BUILT_AT ?? null,
  });
}
