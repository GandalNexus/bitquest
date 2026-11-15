import { verifyCertificate } from "@/lib/certificates/sign";
import { clientIp, rateLimit } from "@/lib/bitquest/session";
import { jsonWithProtocolVersion } from "@/lib/bitlab/response";

/**
 * GET /api/certificates/verify?blob=<signed>
 *
 * Endpoint public (lecture seule) qui vérifie la signature d'un
 * Certificate exporté et renvoie son payload décodé.
 *
 * Usage :
 *   - Un relay / portfolio tiers colle le blob dans cette URL pour
 *     confirmer que le certificat a bien été émis par cette instance
 *     BitQuest (signature HMAC).
 *   - La signature est symétrique en V1 : seul le serveur peut la
 *     recalculer. V2 Schnorr-secp256k1 permettra la vérif offline.
 *
 * Sécurité :
 *   - Public (pas d'auth), mais rate-limit 60/60s par IP pour éviter
 *     le pumping.
 *   - Pas d'écriture DB (route pure crypto).
 *   - Pas d'exposition de la clé — seul le résultat de la vérification
 *     est renvoyé.
 */
export async function GET(req: Request): Promise<Response> {
  if (!(await rateLimit(`cert-verify-ip:${clientIp(req)}`, 60, 60_000))) {
    return jsonWithProtocolVersion(
      { error: "Trop de requêtes depuis cette IP." },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const blob = url.searchParams.get("blob")?.trim() ?? "";
  if (blob.length < 10 || blob.length > 8192) {
    return jsonWithProtocolVersion(
      { ok: false, error: "Paramètre blob manquant ou invalide." },
      { status: 400 },
    );
  }

  try {
    const payload = verifyCertificate(blob);
    return jsonWithProtocolVersion({ ok: true, payload });
  } catch (err) {
    return jsonWithProtocolVersion(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Vérification échouée.",
      },
      { status: 400 },
    );
  }
}
