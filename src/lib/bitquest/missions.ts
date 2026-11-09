import crypto from "crypto";

/* ============ Helpers ============ */

const randHex = (bytes: number) => crypto.randomBytes(bytes).toString("hex");
const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const randB58 = (n: number) => Array.from({ length: n }, () => pick(BASE58.split(""))).join("");

export type MissionChallenge = Record<string, unknown>;
export type MissionExpected = Record<string, unknown>;
export type MissionAnswer = Record<string, unknown>;

export interface MissionResult {
  success: boolean;
  feedback: string;
  proof?: Record<string, unknown>;
}

/* ============ Génération de défis ============ */

export function generateMission(
  missionType: string,
  config: Record<string, unknown>,
): { challenge: MissionChallenge; expected: MissionExpected } {
  switch (missionType) {
    case "block_explorer":
      return genBlockExplorer();
    case "key_forge":
      return genKeyForge();
    case "tx_builder":
      return genTxBuilder(config);
    case "mine_nonce":
      return genMineNonce(config);
    case "ln_channel":
      return genLnChannel();
    case "ln_invoice":
      return genLnInvoice(config);
    case "multisig_sign":
      return genMultisig(config);
    case "taproot_tweak":
      return genTaproot();
    default:
      return genBlockExplorer();
  }
}

function genBlockExplorer() {
  const height = randInt(840_000, 878_000);
  const hash = randHex(32);
  const txCount = randInt(1_200, 4_800);
  const challenge = {
    height,
    hash,
    nonce: randInt(1_000_000_000, 4_000_000_000),
    size: randInt(900_000, 1_900_000),
    txCount,
    timestamp: new Date(Date.now() - randInt(1, 400) * 60_000).toISOString(),
    miner: pick(["Foundry USA", "AntPool", "F2Pool", "ViaBTC", "Ocean", "Braiins Pool"]),
    difficulty: (randInt(6_000, 9_000) / 100).toFixed(2) + " T",
  };
  const expected = { txCount, hashSuffix: hash.slice(-6) };
  return { challenge, expected };
}

function genKeyForge() {
  const pubkey = "02" + randHex(32);
  const address = "bc1q" + randB58(38).toLowerCase();
  const challenge = {
    wif: "cV" + randB58(49),
    pubkey,
    address,
    network: "Testnet BitLab (sandbox)",
  };
  const expected = { addressSuffix: address.slice(-4) };
  return { challenge, expected };
}

interface Utxo {
  id: string;
  sats: number;
}

function buildUtxos(target: number, fastFee: number): Utxo[] {
  const utxos: Utxo[] = [];
  let sum = 0;
  const count = randInt(3, 4);
  for (let i = 0; i < count; i++) {
    const sats = randInt(12_000, 60_000);
    utxos.push({ id: randHex(4), sats });
    sum += sats;
  }
  // Garantit qu'une solution existe : assez de fonds même avec les frais rapides
  while (sum < target + fastFee * 2 + 5_000) {
    const sats = randInt(20_000, 70_000);
    utxos.push({ id: randHex(4), sats });
    sum += sats;
  }
  return utxos;
}

function genTxBuilder(config: Record<string, unknown>) {
  const variant = (config.variant as string) ?? "payment";
  const feeSats = (config.feeSats as Record<string, number>) ?? { slow: 800, medium: 2000, fast: 5000 };

  if (variant === "fee_opt") {
    const vbytes = (config.vbytes as number) ?? 250;
    const feeRates = (config.feeRates as Record<string, number>) ?? { slow: 5, medium: 25, fast: 80 };
    const challenge = {
      variant,
      vbytes,
      feeRates,
      mempool: "congesté — 300 000 transactions en attente",
      nextBlockRate: feeRates.fast,
      recipient: "bc1q" + randB58(30).toLowerCase(),
    };
    const expected = { variant: "fee_opt", speed: "fast", totalFee: feeRates.fast * vbytes };
    return { challenge, expected };
  }

  const target = variant === "payment" ? ((config.target as number) ?? 45_000) : 0;
  const utxos = buildUtxos(target, feeSats.fast);
  const total = utxos.reduce((a, u) => a + u.sats, 0);
  const challenge = {
    variant,
    utxos,
    total,
    target,
    recipient: "bc1q" + randB58(30).toLowerCase(),
    feeSats,
    label:
      variant === "payment"
        ? "Paiement unique"
        : "Consolidation : sélectionne TOUS les UTXO pour les regrouper en une seule sortie",
  };
  const expected = {
    variant,
    utxoMap: Object.fromEntries(utxos.map((u) => [u.id, u.sats])),
    target,
    feeSats,
  };
  return { challenge, expected };
}

function genMineNonce(config: Record<string, unknown>) {
  const prefix = (config.difficulty as string) ?? "000";
  const maxNonce = (config.maxNonce as number) ?? 60_000;
  let header = randHex(20);
  let found = -1;
  for (let n = 0; n <= maxNonce; n++) {
    if (sha256(header + n).startsWith(prefix)) {
      found = n;
      break;
    }
  }
  if (found < 0) {
    header = randHex(20);
    for (let n = 0; n <= maxNonce; n++) {
      if (sha256(header + n).startsWith(prefix)) {
        found = n;
        break;
      }
    }
  }
  const challenge = { header, prefix, maxNonce, algo: "SHA-256d (simulation)" };
  const expected = { prefix, header, guaranteedNonce: found };
  return { challenge, expected };
}

const PEERS = [
  { name: "ACINQ", baseFee: 0, uptime: 99 },
  { name: "Bitrefill", baseFee: 0, uptime: 98 },
  { name: "WalletOfSatoshi", baseFee: 0, uptime: 99 },
  { name: "NodeArk-01", baseFee: 1, uptime: 91 },
];

function genLnChannel() {
  const myBalance = 100_000;
  const peers = PEERS.map((p) => ({
    name: p.name,
    pubkey: randHex(33),
    minCapacity: pick([20_000, 30_000, 40_000, 50_000]),
    baseFee: p.baseFee,
    uptime: p.uptime,
    channels: randInt(200, 3_000),
  }));
  const challenge = { myBalance, peers, dustLimit: 20_000 };
  const expected = { myBalance, peers };
  return { challenge, expected };
}

function genLnInvoice(config: Record<string, unknown>) {
  const amountSats = (config.amountSats as number) ?? randInt(1_000, 100_000);
  const expiry = (config.expiry as number) ?? pick([600, 1800, 3600, 7200]);
  const bolt11 = `lntb${amountSats}sat1${randHex(14)}exp${expiry}z${randHex(3)}`;
  const challenge = {
    bolt11,
    payeeNode: pick(PEERS).name + " (BitLab)",
    description: "Mission BitQuest - sandbox",
  };
  const expected = { amount: amountSats, expiry };
  return { challenge, expected };
}

function genMultisig(config: Record<string, unknown>) {
  const policy = (config.policy as string) ?? "2-of-3";
  const [m, n] = policy.split("-of-").map(Number);
  const labels = ["Clé A (téléphone)", "Clé B (hardware wallet)", "Clé C (sauvegarde papier)"];
  const keys = labels.map((label) => ({ label, pubkey: randHex(33) }));
  const challenge = { policy, m, n, keys, txLabel: "Sortie coffre-fort BitLab" };
  const expected = { m, n };
  return { challenge, expected };
}

function genTaproot() {
  const correctIdx = randInt(0, 2);
  const internalKey = randHex(32);
  const candidates = [0, 1, 2].map((i) => ({
    key: i === correctIdx ? sha256(internalKey + "tweak").slice(0, 64) : randHex(32),
  }));
  const challenge = {
    internalKey,
    candidates,
    scriptPaths: ["récupération simple", "timelock 6 mois + récupération", "multisig 2-of-3"],
    question:
      "Quelle sortie correspond à la clé interne tweakée, et quel est le chemin de dépense par défaut de Taproot ?",
  };
  const expected = { correctIdx, path: "key" };
  return { challenge, expected };
}

/* ============ Validation ============ */

export function validateMission(
  missionType: string,
  session: { challenge: MissionChallenge; expected: MissionExpected },
  answer: MissionAnswer,
): MissionResult {
  try {
    switch (missionType) {
      case "block_explorer":
        return checkBlockExplorer(session, answer);
      case "key_forge":
        return checkKeyForge(session, answer);
      case "tx_builder":
        return checkTxBuilder(session, answer);
      case "mine_nonce":
        return checkMineNonce(session, answer);
      case "ln_channel":
        return checkLnChannel(session, answer);
      case "ln_invoice":
        return checkLnInvoice(session, answer);
      case "multisig_sign":
        return checkMultisig(session, answer);
      case "taproot_tweak":
        return checkTaproot(session, answer);
      default:
        return { success: false, feedback: "Type de mission inconnu." };
    }
  } catch {
    return { success: false, feedback: "Réponse malformée. Vérifie les champs et réessaie." };
  }
}

function checkBlockExplorer(
  session: { challenge: MissionChallenge; expected: MissionExpected },
  answer: MissionAnswer,
): MissionResult {
  const exp = session.expected as { txCount: number; hashSuffix: string };
  const challenge = session.challenge as unknown as { height: number; hash: string };
  const txCount = Number(answer.txCount);
  const suffix = String(answer.hashSuffix ?? "")
    .trim()
    .toLowerCase();
  if (txCount !== exp.txCount) {
    return {
      success: false,
      feedback: `Le nombre de transactions est incorrect. Relis bien le champ "Transactions" dans l'explorateur BitLab.`,
    };
  }
  if (suffix !== exp.hashSuffix.toLowerCase()) {
    return {
      success: false,
      feedback: `Le suffixe du hash ne correspond pas. Attention à copier exactement les 6 derniers caractères.`,
    };
  }
  return {
    success: true,
    feedback: "Bloc vérifié ! Tu maîtrises la lecture d'un explorateur de blocs.",
    proof: { type: "block", blockHash: challenge.hash, height: challenge.height },
  };
}

function checkKeyForge(
  session: { challenge: MissionChallenge; expected: MissionExpected },
  answer: MissionAnswer,
): MissionResult {
  const exp = session.expected as { addressSuffix: string };
  const challenge = session.challenge as unknown as { address: string; pubkey: string };
  const suffix = String(answer.addressSuffix ?? "")
    .trim()
    .toLowerCase();
  if (suffix !== exp.addressSuffix.toLowerCase()) {
    return {
      success: false,
      feedback:
        "Suffixe incorrect. Vérifie les 4 derniers caractères de l'adresse générée — toujours vérifier une adresse avant d'envoyer !",
    };
  }
  return {
    success: true,
    feedback:
      "Paire de clés forgée et adresse vérifiée. Not your keys, not your coins — désormais tu sais ce que ça veut dire.",
    proof: { type: "keys", address: challenge.address, pubkey: challenge.pubkey },
  };
}

function checkTxBuilder(
  session: { challenge: MissionChallenge; expected: MissionExpected },
  answer: MissionAnswer,
): MissionResult {
  const exp = session.expected as {
    variant: string;
    utxoMap: Record<string, number>;
    target: number;
    feeSats: Record<string, number>;
  };

  if (exp.variant === "fee_opt") {
    const speed = String(answer.speed ?? "");
    const totalFee = Number(answer.totalFee);
    if (speed !== "fast") {
      return {
        success: false,
        feedback:
          "Mauvaise vitesse : le mempool est saturé, seuls les frais rapides garantissent une confirmation dans le prochain bloc.",
      };
    }
    const expectedFee = Number(session.expected.totalFee);
    if (totalFee !== expectedFee) {
      return {
        success: false,
        feedback: `Calcul des frais incorrect. Rappel : frais totaux = taux (sats/vByte) x taille (vByte).`,
      };
    }
    return {
      success: true,
      feedback: "Frais calibrés au sats près. Tu sais lire le marché du mempool.",
      proof: {
        type: "tx",
        txid: randHex(32),
        fee: totalFee,
        change: 0,
        feeRate: Number(
          session.challenge && (session.challenge as Record<string, unknown>).feeRates
            ? ((session.challenge as Record<string, unknown>).feeRates as Record<string, number>).fast
            : 80,
        ),
      },
    };
  }

  const selected = Array.isArray(answer.selected) ? (answer.selected as string[]) : [];
  const speed = String(answer.speed ?? "medium");
  const fee = exp.feeSats[speed] ?? 0;
  if (selected.length === 0) {
    return {
      success: false,
      feedback: "Aucun UTXO sélectionné. Une transaction doit consommer au moins un input.",
    };
  }
  const sum = selected.reduce((acc, id) => acc + (exp.utxoMap[id] ?? 0), 0);
  if (sum === 0) {
    return { success: false, feedback: "Les UTXO sélectionnés sont introuvables dans le sandbox." };
  }

  if (exp.variant === "consolidation") {
    const allIds = Object.keys(exp.utxoMap);
    if (selected.length < allIds.length) {
      return {
        success: false,
        feedback: `Il manque des UTXO : une consolidation regroupe TOUS les petits UTXO (${allIds.length} ici) en une seule sortie.`,
      };
    }
    const change = sum - fee;
    if (change <= 0) {
      return {
        success: false,
        feedback: "Les frais dépassent le total. Choisis une vitesse de confirmation plus lente.",
      };
    }
    return {
      success: true,
      feedback: `Consolidation réussie : ${allIds.length} UTXO regroupés en une seule sortie de ${change.toLocaleString("fr-FR")} sats.`,
      proof: { type: "tx", txid: randHex(32), fee, change, inputs: allIds.length },
    };
  }

  const target = exp.target;
  if (sum < target + fee) {
    const missing = target + fee - sum;
    return {
      success: false,
      feedback: `Montant insuffisant : il manque ${missing.toLocaleString("fr-FR")} sats pour couvrir l'envoi + les frais. Sélectionne plus d'UTXO.`,
    };
  }
  const change = sum - target - fee;
  return {
    success: true,
    feedback: `Transaction construite : ${target.toLocaleString("fr-FR")} sats envoyés, ${fee.toLocaleString("fr-FR")} sats de frais, ${change.toLocaleString("fr-FR")} sats de change retournés à ton adresse.`,
    proof: { type: "tx", txid: randHex(32), fee, change },
  };
}

function checkMineNonce(
  session: { challenge: MissionChallenge; expected: MissionExpected },
  answer: MissionAnswer,
): MissionResult {
  const exp = session.expected as { prefix: string; header: string };
  const nonce = Math.floor(Number(answer.nonce));
  if (!Number.isFinite(nonce) || nonce < 0 || nonce > 100_000_000) {
    return { success: false, feedback: "Nonce invalide." };
  }
  const hash = sha256(exp.header + nonce);
  if (!hash.startsWith(exp.prefix)) {
    return {
      success: false,
      feedback: "Ce nonce ne produit pas un hash valide : le réseau rejette ton bloc. Continue de miner !",
    };
  }
  return {
    success: true,
    feedback: `Bloc miné ! Hash ${hash.slice(0, 16)}... validé par le réseau simulé. Tu viens de vivre le Proof of Work.`,
    proof: { type: "block_mined", hash, nonce },
  };
}

function checkLnChannel(
  session: { challenge: MissionChallenge; expected: MissionExpected },
  answer: MissionAnswer,
): MissionResult {
  const exp = session.expected as {
    myBalance: number;
    peers: { name: string; minCapacity: number; pubkey: string }[];
  };
  const peerIndex = Math.floor(Number(answer.peerIndex));
  const capacity = Math.floor(Number(answer.capacity));
  if (peerIndex < 0 || peerIndex >= exp.peers.length) {
    return { success: false, feedback: "Pair sélectionné invalide." };
  }
  const peer = exp.peers[peerIndex];
  if (capacity < 20_000) {
    return {
      success: false,
      feedback:
        "Capacité trop faible : en dessous de 20 000 sats (dust limit), le canal est refusé par le réseau.",
    };
  }
  if (capacity > exp.myBalance) {
    return {
      success: false,
      feedback: `Tu ne disposes que de ${exp.myBalance.toLocaleString("fr-FR")} sats dans le wallet BitLab.`,
    };
  }
  if (capacity < peer.minCapacity) {
    return {
      success: false,
      feedback: `${peer.name} exige une capacité minimale de ${peer.minCapacity.toLocaleString("fr-FR")} sats pour ouvrir un canal.`,
    };
  }
  return {
    success: true,
    feedback: `Canal ouvert avec ${peer.name} : ${capacity.toLocaleString("fr-FR")} sats de capacité locale. Bienvenue sur le Lightning Network.`,
    proof: {
      type: "channel",
      channelId: randHex(16),
      fundingTxid: randHex(32),
      capacity,
      peer: peer.name,
      peerPubkey: peer.pubkey,
    },
  };
}

function checkLnInvoice(
  session: { challenge: MissionChallenge; expected: MissionExpected },
  answer: MissionAnswer,
): MissionResult {
  const exp = session.expected as { amount: number; expiry: number };
  const amount = Math.floor(Number(answer.amount));
  const expiry = Math.floor(Number(answer.expiry));
  if (amount !== exp.amount) {
    return {
      success: false,
      feedback: "Montant incorrect : décode bien le montant encodé juste après « lntb » dans la facture.",
    };
  }
  if (expiry !== exp.expiry) {
    return {
      success: false,
      feedback: "Expiration incorrecte : cherche le champ « exp » dans la facture BOLT11.",
    };
  }
  return {
    success: true,
    feedback:
      "Facture décodée : montant et expiration extraits correctement. Tu peux payer en toute confiance.",
    proof: { type: "invoice", paymentHash: randHex(32), amount, expiry },
  };
}

function checkMultisig(
  session: { challenge: MissionChallenge; expected: MissionExpected },
  answer: MissionAnswer,
): MissionResult {
  const exp = session.expected as { m: number; n: number };
  const signers = Array.isArray(answer.signers) ? (answer.signers as unknown[]).map(Number) : [];
  const unique = new Set(signers);
  if (unique.size !== exp.m || signers.length !== exp.m) {
    return {
      success: false,
      feedback: `Politique ${exp.m}-de-${exp.n} : exactement ${exp.m} signatures sont requises, pas ${signers.length}.`,
    };
  }
  if (signers.some((s) => !Number.isInteger(s) || s < 0 || s >= exp.n)) {
    return { success: false, feedback: "Signataire invalide." };
  }
  return {
    success: true,
    feedback: `Transaction ${exp.m}-de-${exp.n} signée avec ${exp.m} clés sur ${exp.n}. Ton coffre-fort est sécurisé.`,
    proof: { type: "psbt", psbt: randHex(24), signatures: signers.length, policy: `${exp.m}-de-${exp.n}` },
  };
}

function checkTaproot(
  session: { challenge: MissionChallenge; expected: MissionExpected },
  answer: MissionAnswer,
): MissionResult {
  const exp = session.expected as { correctIdx: number; path: string };
  const choice = Math.floor(Number(answer.choice));
  const path = String(answer.path ?? "");
  if (choice !== exp.correctIdx) {
    return {
      success: false,
      feedback:
        "Mauvaise sortie : seule l'une des trois clés est le résultat du tweak de la clé interne. Cherche la dérivation cohérente.",
    };
  }
  if (path !== exp.path) {
    return {
      success: false,
      feedback:
        "Le chemin par défaut de Taproot est le key path : la signature Schnorr sur la clé tweakée révèle le moins d'information possible.",
    };
  }
  return {
    success: true,
    feedback: "Sortie Taproot identifiée et chemin de dépense compris. Tu connais le futur de Bitcoin.",
    proof: {
      type: "taproot",
      outputKey: (session.challenge as { candidates: { key: string }[] }).candidates[exp.correctIdx].key,
      witnessVersion: 1,
    },
  };
}
