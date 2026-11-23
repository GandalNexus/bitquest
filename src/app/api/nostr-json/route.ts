import { jsonWithProtocolVersion } from "@/lib/bitlab/response";
import {
  getInstancePublicKeyHex,
  hasInstanceSchnorrKey,
} from "@/lib/certificates/schnorr";

/**
 * GET /api/nostr-json — accessible publiquement via le rewrite
 * `/.well-known/nostr.json` (voir next.config.ts).
 *
 * Variante NIP-11 pour BitQuest : expose la pubkey Schnorr qui signe
 * les Certificates v2. Permet à n'importe quel client Nostr ou
 * portfolio de vérifier offline une attestation BitQuest.
 *
 * Champs standards NIP-11 présents (name, description, pubkey,
 * contact, supported_nips, software, version) + extension
 * `bitquest` avec les endpoints de l'écosystème.
 *
 * Public, read-only, zéro secret. La pubkey est publiable par design.
 */
export function GET(): Response {
  const schnorrEnabled = hasInstanceSchnorrKey();
  const issuer = process.env.NEXT_PUBLIC_BITQUEST_HOST ?? "bitquest.local";
  return jsonWithProtocolVersion({
    name: `BitQuest · ${issuer}`,
    description:
      "BitQuest signe les Certificates des apprenants qui complètent une quête Bitcoin. La clé publique ci-dessous permet la vérification offline.",
    pubkey: schnorrEnabled ? getInstancePublicKeyHex() : null,
    contact: null,
    supported_nips: [11, 19],
    software: "https://github.com/your-username/bitquest",
    version: process.env.npm_package_version ?? "0.0.0",
    bitquest: {
      issuer,
      certificateVersions: schnorrEnabled ? [1, 2] : [1],
      verifyEndpoint: `https://${issuer}/api/certificates/verify`,
      verifyUi: `https://${issuer}/verify`,
    },
  });
}
