import { authenticate, clientIp, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { bitlabDeepLinkSchema, parseJsonBody } from "@/lib/validation/schemas";
import { buildBitlabDeepLink, signDeepLinkPayload } from "@/lib/bitlab/deep-link";
import { PROTOCOL_VERSION } from "@/lib/bitlab/protocol";
import { db } from "@/lib/db";

function getSignSecret(): string | null {
  return process.env.BITLAB_SIGN_SECRET?.trim() || null;
}

/**
 * Longueurs max des hints envoyés à BitLab. Le but est d'éviter des
 * URLs absurdes (certaines missions ont des `brief` multi-paragraphes
 * dans le seed). BitLab tronque de toute façon à l'affichage.
 */
const TITLE_MAX = 120;
const INSTRUCTIONS_MAX = 300;

/**
 * Extrait un couple (title, instructions) à exposer dans la deep-link
 * pour que BitLab affiche un rappel pédagogique à l'apprenant sans
 * avoir besoin d'un appel API cross-origin vers BitQuest. Ces valeurs
 * ne sont PAS signées par le HMAC : purement cosmétiques, la validation
 * de preuve reste strictement serveur.
 */
function extractMissionHints(quest: {
  title: string | null;
  missionConfig: string | null;
}): { title: string; instructions: string } {
  const title = (quest.title ?? "").trim().slice(0, TITLE_MAX);
  let instructions = "";
  if (quest.missionConfig) {
    try {
      const cfg = JSON.parse(quest.missionConfig) as { brief?: unknown };
      if (typeof cfg.brief === "string") {
        instructions = cfg.brief.trim().slice(0, INSTRUCTIONS_MAX);
      }
    } catch {
      // missionConfig corrompu → on ignore silencieusement, les hints
      // sont facultatifs. L'audit log est géré ailleurs.
    }
  }
  return { title, instructions };
}

/**
 * POST /api/bitlab/deep-link — construit l'URL deep-link de BitLab.
 *
 * Si BITLAB_SIGN_SECRET est configuré, l'URL est signée (params `sig`
 * et `ts` ajoutés). Sinon, l'URL est non signée (comportement legacy).
 * Le client peut appeler l'endpoint sans se soucier du secret.
 */
export async function POST(req: Request) {
  // Rate-limit IP AVANT auth (anti-DoS), ratio × 4 du userId limit.
  if (!(await rateLimit(`bitlab-deep-link-ip:${clientIp(req)}`, 120, 60_000))) {
    return Response.json({ error: "Trop de requêtes depuis cette IP." }, { status: 429 });
  }
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`bitlab-deep-link:${user.id}`, 30, 60_000))) {
    return Response.json({ error: "Trop de requêtes, patiente une minute." }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, bitlabDeepLinkSchema);
  if (!parsed.ok) return parsed.response;
  const { questCode, kind, network, returnTo } = parsed.data;

  // Lookup quête pour enrichir le contexte mission (I2).
  // Si la quête n'existe pas on continue sans hints — l'intégration
  // fonctionnelle reste protégée côté serveur à la soumission de preuve.
  const quest = await db.quest.findUnique({
    where: { code: questCode },
    select: { title: true, missionConfig: true },
  });

  const base =
    process.env.NEXT_PUBLIC_BITLAB_URL?.trim() || "https://bitlab.example/mission";

  const secret = getSignSecret();
  const extra: Record<string, string | number> = {};
  let signed = false;
  if (secret) {
    const ts = Math.floor(Date.now() / 1000);
    const sig = signDeepLinkPayload({
      userId: user.id,
      questCode,
      kind,
      network,
      ts,
      secret,
      v: PROTOCOL_VERSION,
    });
    extra.ts = ts;
    extra.sig = sig;
    extra.v = PROTOCOL_VERSION;
    signed = true;
  }

  // Hints pédagogiques (non signés — purement UX).
  if (quest) {
    const { title, instructions } = extractMissionHints(quest);
    if (title) extra.title = title;
    if (instructions) extra.instructions = instructions;
  }

  const url = buildBitlabDeepLink({
    base,
    questCode,
    kind,
    network,
    returnTo,
    extra,
  });

  return Response.json({ ok: true, url, signed, protocolVersion: PROTOCOL_VERSION });
}
