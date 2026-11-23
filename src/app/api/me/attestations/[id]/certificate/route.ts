import { authenticate, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { db } from "@/lib/db";
import { signCertificate, type CertificatePayload } from "@/lib/certificates/sign";
import {
  hasInstanceSchnorrKey,
  signCertificateSchnorr,
} from "@/lib/certificates/schnorr";
import { logger } from "@/lib/log";

const log = logger("certificate-issue");

/**
 * POST /api/me/attestations/[id]/certificate — émet un Certificate
 * signé pour l'Attestation donnée (LOT 28).
 *
 * Auth :
 *   - `authenticate` (cookie session OU header legacy).
 *   - `requireCsrf` si auth cookie.
 *
 * Idempotent : si un Certificate v1 existe déjà pour cette
 * attestation, on le renvoie plutôt que d'en créer un nouveau.
 *
 * Retour :
 *   { certificateId, signedBlob, payload }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }

  const { id: attestationId } = await params;
  const attestation = await db.attestation.findUnique({
    where: { id: attestationId },
    include: {
      Certificate: {
        where: { format: "JSON_V1" },
        take: 1,
      },
    },
  });
  if (!attestation) {
    return Response.json({ error: "Attestation introuvable." }, { status: 404 });
  }
  if (attestation.userId !== user.id) {
    // Anti-IDOR : on renvoie 404 plutôt que 403 pour ne pas leak
    // l'existence de l'attestation d'un autre user.
    return Response.json({ error: "Attestation introuvable." }, { status: 404 });
  }

  // Idempotence : certif déjà émis → on recalcule le blob depuis les
  // mêmes champs persistés (évite drift si pseudo a changé entre temps).
  const existing = attestation.Certificate[0];
  let certificateId: string;
  let targetTitle = attestation.targetCode;
  if (attestation.kind === "QUEST") {
    const quest = await db.quest.findUnique({
      where: { code: attestation.targetCode },
      select: { title: true },
    });
    if (quest) targetTitle = quest.title;
  }
  const issuer = process.env.NEXT_PUBLIC_BITQUEST_HOST ?? "bitquest.local";
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(attestation.metadata) as unknown;
    if (parsed && typeof parsed === "object") metadata = parsed as Record<string, unknown>;
  } catch {
    metadata = {};
  }

  if (existing) {
    certificateId = existing.id;
  } else {
    const row = await db.certificate.create({
      data: {
        attestationId: attestation.id,
        format: "JSON_V1",
        signatureJson: "{}",
      },
    });
    certificateId = row.id;
    log.info({ userId: user.id, certificateId, attestationId }, "certificate émis");
  }

  // LOT 71 : si une clé Schnorr est configurée, on émet aussi la v2
  // (vérifiable offline via NIP-11). On renvoie TOUJOURS la v1 HMAC
  // pour la compatibilité ascendante.
  const useSchnorr = hasInstanceSchnorrKey();

  const payloadV1: CertificatePayload = {
    v: 1,
    certificateId,
    attestationId: attestation.id,
    userId: user.id,
    kind: attestation.kind,
    targetCode: attestation.targetCode,
    targetTitle,
    issuedAt: attestation.issuedAt.toISOString(),
    metadata,
    pseudo: user.pseudo,
    issuer,
  };
  const signedBlob = signCertificate(payloadV1);

  let signedBlobV2: string | null = null;
  if (useSchnorr) {
    const payloadV2 = { ...payloadV1, v: 2 as const };
    signedBlobV2 = await signCertificateSchnorr(payloadV2);
  }

  return Response.json({
    certificateId,
    signedBlob,
    signedBlobV2,
    payload: payloadV1,
  });
}
