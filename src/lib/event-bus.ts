import { logger } from "@/lib/log";

const log = logger("event-bus");

/* ============================================================
 * EventBus GandalNexus (P3).
 *
 * Bus de domaine in-process, sans dépendance externe. Objectif :
 * permettre à des modules futurs (analytics, Nostr, email, badges)
 * de s'abonner aux évènements métier (quête complétée, badge
 * débloqué, launch token émis, …) sans que le producteur les
 * connaisse.
 *
 * Non :
 *   - Pas de persistance (si le process redémarre, les évènements
 *     émis sont perdus → ne pas l'utiliser pour des side-effects
 *     critiques tant que la persistance n'est pas ajoutée).
 *   - Pas de Kafka / Redis Streams — c'est délibéré, YAGNI à ce stade.
 *   - Pas de retry : les handlers qui throw sont loggés en warn et
 *     ignorés. L'émetteur ne bloque jamais.
 *
 * Signature volontairement strict-typé par évènement : permet au
 * compilateur de refuser un payload mal formé.
 * ============================================================ */

/** Catalogue des évènements. Ajoute une entrée pour émettre un nouveau type. */
export interface EventPayloadMap {
  "quest.completed": { userId: string; questCode: string; xpEarned: number; satsEarned: number };
  "badge.earned": { userId: string; badgeCode: string };
  "launch-token.issued": { userId: string; nonce: string };
  "lesson.completed": { userId: string; lessonId: string };
  "mission-attempt.completed": { userId: string; attemptId: string; questCode: string };
}

export type EventName = keyof EventPayloadMap;

type Handler<E extends EventName> = (payload: EventPayloadMap[E]) => void | Promise<void>;

/** Une instance partagée process-wide. */
const handlers: Map<EventName, Set<Handler<EventName>>> = new Map();

/**
 * Abonne un handler à un évènement. Retourne une fonction de
 * désabonnement (pratique pour les hooks React / cleanup de tests).
 */
export function on<E extends EventName>(event: E, handler: Handler<E>): () => void {
  const set = handlers.get(event) ?? new Set();
  set.add(handler as Handler<EventName>);
  handlers.set(event, set);
  return () => {
    set.delete(handler as Handler<EventName>);
  };
}

/**
 * Émet un évènement. Appelle chaque handler en try/catch : un handler
 * qui throw ne bloque pas les autres. Retourne le nombre de handlers
 * invoqués (utile pour les tests + observabilité).
 *
 * Les handlers sont lancés en parallèle via Promise.allSettled. Si tu
 * as besoin d'un ordre, abonne-toi à un évènement « parent » qui
 * ré-émet en séquence.
 */
export async function emit<E extends EventName>(
  event: E,
  payload: EventPayloadMap[E],
): Promise<number> {
  const set = handlers.get(event);
  if (!set || set.size === 0) return 0;
  const results = await Promise.allSettled(
    Array.from(set).map(async (h) => {
      try {
        await (h as Handler<E>)(payload);
      } catch (err) {
        log.warn(
          { event, err: err instanceof Error ? err.message : String(err) },
          "handler event-bus a throw, ignoré",
        );
      }
    }),
  );
  return results.length;
}

/**
 * Désabonne tous les handlers d'un évènement. Utile pour les tests
 * (`afterEach(() => clearAll())`). Ne jamais appeler en runtime.
 */
export function clearAll(): void {
  handlers.clear();
}
