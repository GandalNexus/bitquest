import { db } from "@/lib/db";
import { logger } from "@/lib/log";

const log = logger("mission-attempt");

/**
 * MissionAttempt — API serveur (Phase 4, LOT 1).
 *
 * Trace durable d'une tentative de mission BitLab lancée depuis BitQuest.
 * Résout : avant, une mission exécutée dans BitLab pouvait être perdue si
 * l'utilisateur fermait le navigateur avant la redirection de retour.
 *
 * La récompense finale reste attribuée par `/api/quests/[code]/progress`
 * (branche `mission_submit`). `resultJson` ici n'est qu'un snapshot pour
 * permettre à l'UI de reprendre un flux interrompu.
 */

export type AttemptState =
  | "CREATED"
  | "IN_PROGRESS"
  | "PROOF_PENDING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "ABANDONED";

export const TERMINAL_STATES: readonly AttemptState[] = [
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "ABANDONED",
];

export const ACTIVE_STATES: readonly AttemptState[] = [
  "CREATED",
  "IN_PROGRESS",
  "PROOF_PENDING",
  "VERIFYING",
];

/**
 * Transitions autorisées. Clé = état courant, valeur = états cibles permis.
 * Toute tentative hors de cette table est rejetée côté serveur.
 */
const ALLOWED_TRANSITIONS: Record<AttemptState, AttemptState[]> = {
  CREATED: ["IN_PROGRESS", "ABANDONED", "EXPIRED"],
  IN_PROGRESS: ["PROOF_PENDING", "ABANDONED", "EXPIRED"],
  PROOF_PENDING: ["VERIFYING", "FAILED", "ABANDONED", "EXPIRED"],
  VERIFYING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  EXPIRED: [],
  ABANDONED: [],
};

/** TTL par défaut d'une tentative : 2h. Les quêtes longues peuvent étendre via opts. */
export const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

export interface CreateAttemptInput {
  userId: string;
  questId: string;
  questCode: string;
  kind: string;
  network: string;
  returnTo?: string | null;
  ttlMs?: number;
}

/**
 * Crée une tentative à l'état `CREATED`. Appelée depuis `/api/bitlab/deep-link`
 * avant que l'URL ne soit signée. L'`id` retourné est embarqué dans l'URL
 * puis dans le JWT challenge pour lier toutes les étapes.
 */
export async function createAttempt(input: CreateAttemptInput): Promise<{
  id: string;
  expiresAt: Date;
}> {
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  const row = await db.missionAttempt.create({
    data: {
      userId: input.userId,
      questId: input.questId,
      questCode: input.questCode,
      kind: input.kind,
      network: input.network,
      state: "CREATED",
      expiresAt,
      returnTo: input.returnTo ?? null,
    },
    select: { id: true, expiresAt: true },
  });
  log.info(
    { attemptId: row.id, userId: input.userId, questCode: input.questCode, kind: input.kind },
    "mission attempt created",
  );
  return row;
}

/**
 * Récupère une tentative scope userId (défense contre IDOR).
 * Retourne null si non trouvée ou appartenant à un autre user.
 */
export async function getAttemptForUser(
  attemptId: string,
  userId: string,
): Promise<AttemptRecord | null> {
  if (!attemptId || !userId) return null;
  const row = await db.missionAttempt.findFirst({
    where: { id: attemptId, userId },
  });
  if (!row) return null;
  return toRecord(row);
}

export interface AttemptRecord {
  id: string;
  userId: string;
  questId: string;
  questCode: string;
  kind: string;
  network: string;
  state: AttemptState;
  launchedAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
  abandonedAt: Date | null;
  failedAt: Date | null;
  failReason: string | null;
  proofId: string | null;
  resultJson: string | null;
  returnTo: string | null;
}

function toRecord(row: {
  id: string;
  userId: string;
  questId: string;
  questCode: string;
  kind: string;
  network: string;
  state: string;
  launchedAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
  abandonedAt: Date | null;
  failedAt: Date | null;
  failReason: string | null;
  proofId: string | null;
  resultJson: string | null;
  returnTo: string | null;
}): AttemptRecord {
  return { ...row, state: row.state as AttemptState };
}

export interface TransitionInput {
  attemptId: string;
  userId: string;
  to: AttemptState;
  from?: AttemptState | AttemptState[]; // garde optionnelle : forcer l'origine
  failReason?: string;
  proofId?: string;
  resultJson?: string;
}

export type TransitionOutcome =
  | { ok: true; state: AttemptState }
  | { ok: false; reason: "NOT_FOUND" | "ILLEGAL_TRANSITION" | "EXPIRED" };

/**
 * Transition d'état contrôlée côté serveur via `updateMany` conditionnel
 * (atomique : empêche les races où deux handlers transitent la même row).
 *
 * - Si `from` fourni : impose l'état source (empêche les sauts illégaux
 *   même si la table ALLOWED_TRANSITIONS évolue).
 * - Sinon : utilise la table ALLOWED_TRANSITIONS pour autoriser toute
 *   transition valide depuis l'état courant.
 * - Expiration : si `expiresAt < now` ET état non terminal, force EXPIRED
 *   et rejette la transition demandée.
 */
export async function transitionAttempt(
  input: TransitionInput,
): Promise<TransitionOutcome> {
  const current = await getAttemptForUser(input.attemptId, input.userId);
  if (!current) return { ok: false, reason: "NOT_FOUND" };

  const now = new Date();
  const expired =
    !(TERMINAL_STATES as readonly string[]).includes(current.state) &&
    current.expiresAt.getTime() < now.getTime();
  if (expired) {
    // Marque EXPIRED idempotent, ignore la transition demandée.
    await db.missionAttempt.updateMany({
      where: { id: current.id, state: { in: ACTIVE_STATES as unknown as string[] } },
      data: { state: "EXPIRED" },
    });
    return { ok: false, reason: "EXPIRED" };
  }

  const allowedFrom = input.from
    ? Array.isArray(input.from)
      ? input.from
      : [input.from]
    : (Object.entries(ALLOWED_TRANSITIONS).flatMap(([src, dests]) =>
        dests.includes(input.to) ? [src as AttemptState] : [],
      ) as AttemptState[]);

  if (allowedFrom.length === 0 || !allowedFrom.includes(current.state)) {
    return { ok: false, reason: "ILLEGAL_TRANSITION" };
  }

  const data: Record<string, unknown> = { state: input.to };
  if (input.to === "COMPLETED") data.completedAt = now;
  if (input.to === "FAILED") {
    data.failedAt = now;
    if (input.failReason) data.failReason = input.failReason;
  }
  if (input.to === "ABANDONED") data.abandonedAt = now;
  if (input.proofId) data.proofId = input.proofId;
  if (input.resultJson) data.resultJson = input.resultJson;

  const res = await db.missionAttempt.updateMany({
    where: {
      id: current.id,
      userId: current.userId,
      state: { in: allowedFrom as unknown as string[] },
    },
    data,
  });

  if (res.count === 0) {
    // Course perdue : un autre handler a déjà transité la row.
    return { ok: false, reason: "ILLEGAL_TRANSITION" };
  }

  log.info(
    {
      attemptId: input.attemptId,
      userId: input.userId,
      from: current.state,
      to: input.to,
    },
    "mission attempt transitioned",
  );
  return { ok: true, state: input.to };
}

/**
 * Trouve la tentative ACTIVE la plus récente pour un couple (user, questCode).
 * Sert à lier une soumission de preuve à la tentative en cours quand le
 * client ne transmet pas d'attemptId explicite (compat ascendante).
 */
export async function findLatestActiveAttempt(
  userId: string,
  questCode: string,
  kind?: string,
): Promise<AttemptRecord | null> {
  const row = await db.missionAttempt.findFirst({
    where: {
      userId,
      questCode,
      ...(kind ? { kind } : {}),
      state: { in: ACTIVE_STATES as unknown as string[] },
    },
    orderBy: { launchedAt: "desc" },
  });
  return row ? toRecord(row) : null;
}

/**
 * Batch "expire les tentatives périmées" : utilisable depuis un cron ou
 * un endpoint admin. Idempotent.
 */
export async function expireStaleAttempts(): Promise<number> {
  const res = await db.missionAttempt.updateMany({
    where: {
      state: { in: ACTIVE_STATES as unknown as string[] },
      expiresAt: { lt: new Date() },
    },
    data: { state: "EXPIRED" },
  });
  if (res.count > 0) {
    log.info({ expired: res.count }, "mission attempts expired");
  }
  return res.count;
}
