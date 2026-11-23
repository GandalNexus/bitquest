/**
 * Défis du jour BitQuest — contenu pédagogique léger.
 *
 * On seede 7 défis offsets 0..6 depuis la date de référence passée au seed
 * (par défaut UTC today). L'upsert est idempotent : on utilise la date
 * calculée comme clé unique.
 */

export interface DailyChallengeSeed {
  dayOffset: number; // 0 = aujourd'hui, 1 = demain, …
  title: string;
  prompt: string;
  xpReward: number;
  satsReward: number;
}

export const dailyChallengesSeed: DailyChallengeSeed[] = [
  {
    dayOffset: 0,
    title: "Vérifier une adresse",
    prompt:
      "Avant d'envoyer des sats, compare toujours les 4 premiers et 4 derniers caractères de l'adresse à sa source. Entraîne-toi aujourd'hui sur une adresse de ton wallet BitLab.",
    xpReward: 10,
    satsReward: 25,
  },
  {
    dayOffset: 1,
    title: "Lire un bloc",
    prompt:
      "Ouvre mempool.space et identifie, dans le dernier bloc confirmé : le nombre de transactions, la fee rate médiane, et le mineur qui l'a scellé.",
    xpReward: 15,
    satsReward: 40,
  },
  {
    dayOffset: 2,
    title: "Sauvegarder sa seed phrase",
    prompt:
      "Révise mentalement les 12 ou 24 mots de ta seed phrase et vérifie qu'ils sont toujours accessibles dans TROIS endroits distincts (papier, acier, et un lieu secret).",
    xpReward: 20,
    satsReward: 60,
  },
  {
    dayOffset: 3,
    title: "Décoder une facture Lightning",
    prompt:
      "Prends une facture BOLT11 (par exemple celle d'un bot de Twitter). Décode-la mentalement : montant en sats, expiry, et le nœud qui la demande.",
    xpReward: 15,
    satsReward: 40,
  },
  {
    dayOffset: 4,
    title: "Le halving",
    prompt:
      "Récite de tête : combien de bitcoins reçoit un mineur par bloc aujourd'hui ? Quand aura lieu le prochain halving ? Quel sera le nouveau subsidy ?",
    xpReward: 15,
    satsReward: 40,
  },
  {
    dayOffset: 5,
    title: "Tester son nœud (ou en lancer un)",
    prompt:
      "Si tu as un nœud Bitcoin : vérifie qu'il est synchronisé et à jour. Sinon : lis les 2 premiers paragraphes de bitcoin.org/fr/full-node pour comprendre pourquoi en lancer un.",
    xpReward: 20,
    satsReward: 60,
  },
  {
    dayOffset: 6,
    title: "Partager une idée",
    prompt:
      "Explique à une personne de ton entourage (en 60 secondes) pourquoi Bitcoin est plafonné à 21 millions d'unités. Si tu bloques, relis la Genèse dans l'Académie.",
    xpReward: 10,
    satsReward: 25,
  },
];

/** Décale une date ISO day par N jours UTC. */
export function offsetIsoDay(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
