/**
 * BitQuest — Données pédagogiques de seed.
 * Contenu 100 % français, techniquement exact : 11 quêtes, 15 badges, 8 bots du classement.
 * Aucune dépendance : consommé par le script de seed Prisma.
 */

export interface TheorySection {
  title: string;
  body: string;
  keypoints: string[];
}

export interface QuizSeed {
  type: "MCQ" | "TRUE_FALSE";
  question: string;
  options: string[]; // 4 options pour MCQ, [] pour TRUE_FALSE
  correctIndex?: number; // pour MCQ (0-3)
  correctBool?: boolean; // pour TRUE_FALSE
  explanation: string; // feedback pédagogique affiché après réponse
}

export interface QuestSeed {
  code: string;
  track: "INITIATION" | "INTERMEDIATE" | "ADVANCED" | "SPECIAL";
  order: number;
  title: string;
  subtitle: string;
  description: string; // 1 phrase pour la carte des quêtes
  intro: string; // 2 paragraphes : contexte + objectifs pédagogiques
  requiredLevel: number;
  xpReward: number;
  satsReward: number;
  missionType:
    | "block_explorer"
    | "key_forge"
    | "tx_builder"
    | "mine_nonce"
    | "ln_channel"
    | "ln_invoice"
    | "multisig_sign"
    | "taproot_tweak";
  missionConfig: Record<string, unknown>;
  missionBrief: string; // consigne de la mission pratique
  missionHint: string; // indice
  theorySections: TheorySection[]; // EXACTEMENT 3 sections
  quiz: QuizSeed[]; // EXACTEMENT 4 questions
}

export interface BadgeSeed {
  code: string;
  name: string;
  description: string;
  icon: string; // nom d'icône lucide-react en camelCase
  rarity: "COMMON" | "RARE" | "EPIC";
  conditionType:
    "QUEST_COMPLETE" | "QUEST_COUNT" | "TRACK_COMPLETE" | "STREAK" | "LEVEL" | "SATS_TOTAL" | "PERFECT_QUIZ";
  conditionValue: Record<string, unknown>;
}

export const badgesSeed: BadgeSeed[] = [
  {
    code: "genesis_explorer",
    name: "Explorateur de la Genèse",
    description: "Termine la quête Le Bloc Genèse",
    icon: "Compass",
    rarity: "COMMON",
    conditionType: "QUEST_COMPLETE",
    conditionValue: { questCode: "genesis" },
  },
  {
    code: "keymaster",
    name: "Maître des Clés",
    description: "Termine la quête Clés et Adresses",
    icon: "KeyRound",
    rarity: "COMMON",
    conditionType: "QUEST_COMPLETE",
    conditionValue: { questCode: "keys" },
  },
  {
    code: "utxo_master",
    name: "UTXO Master",
    description: "Termine la quête Maîtrise des UTXO",
    icon: "Boxes",
    rarity: "RARE",
    conditionType: "QUEST_COMPLETE",
    conditionValue: { questCode: "utxo" },
  },
  {
    code: "fee_sniper",
    name: "Sniper des Frais",
    description: "Termine la quête Frais et Mempool",
    icon: "Gauge",
    rarity: "RARE",
    conditionType: "QUEST_COMPLETE",
    conditionValue: { questCode: "fees-mempool" },
  },
  {
    code: "lightning_explorer",
    name: "Lightning Explorer",
    description: "Termine la quête Explorer le Lightning Network",
    icon: "Zap",
    rarity: "RARE",
    conditionType: "QUEST_COMPLETE",
    conditionValue: { questCode: "lightning" },
  },
  {
    code: "halving_hunter",
    name: "Chasseur de Halving",
    description: "Relève le Défi Halving",
    icon: "Pickaxe",
    rarity: "EPIC",
    conditionType: "QUEST_COMPLETE",
    conditionValue: { questCode: "halving-challenge" },
  },
  {
    code: "first_steps",
    name: "Premiers Pas",
    description: "Complète ta première quête",
    icon: "Rocket",
    rarity: "COMMON",
    conditionType: "QUEST_COUNT",
    conditionValue: { count: 1 },
  },
  {
    code: "initiation_hero",
    name: "Héros de l'Initiation",
    description: "Termine toutes les quêtes d'initiation",
    icon: "Star",
    rarity: "COMMON",
    conditionType: "TRACK_COMPLETE",
    conditionValue: { track: "INITIATION" },
  },
  {
    code: "block_architect",
    name: "Architecte Bitcoin",
    description: "Complète 5 quêtes",
    icon: "Blocks",
    rarity: "RARE",
    conditionType: "QUEST_COUNT",
    conditionValue: { count: 5 },
  },
  {
    code: "network_guardian",
    name: "Gardien du Réseau",
    description: "Termine toutes les quêtes avancées",
    icon: "ShieldCheck",
    rarity: "EPIC",
    conditionType: "TRACK_COMPLETE",
    conditionValue: { track: "ADVANCED" },
  },
  {
    code: "streak_3",
    name: "Régulier",
    description: "3 jours d'affilée d'activité",
    icon: "CalendarCheck",
    rarity: "COMMON",
    conditionType: "STREAK",
    conditionValue: { days: 3 },
  },
  {
    code: "streak_7",
    name: "Inarrêtable",
    description: "7 jours d'affilée d'activité",
    icon: "Flame",
    rarity: "EPIC",
    conditionType: "STREAK",
    conditionValue: { days: 7 },
  },
  {
    code: "level_5",
    name: "Vétéran",
    description: "Atteins le niveau 5",
    icon: "Medal",
    rarity: "RARE",
    conditionType: "LEVEL",
    conditionValue: { level: 5 },
  },
  {
    code: "satoshi_jr",
    name: "Héritier de Satoshi",
    description: "Cumule 10 000 satoshis de gains",
    icon: "Gem",
    rarity: "EPIC",
    conditionType: "SATS_TOTAL",
    conditionValue: { sats: 10000 },
  },
  {
    code: "perfect_quiz",
    name: "Sans Faute",
    description: "Réussis un quiz à 100%",
    icon: "Trophy",
    rarity: "RARE",
    conditionType: "PERFECT_QUIZ",
    conditionValue: {},
  },
];

export const questsSeed: QuestSeed[] = [
  {
    code: "genesis",
    track: "INITIATION",
    order: 1,
    title: "Le Bloc Genèse",
    subtitle: "Aux origines de la monnaie souveraine",
    description:
      "Remonte aux origines de Bitcoin : découvre le bloc genèse, Satoshi Nakamoto et la solution élégante au problème de la double dépense.",
    intro:
      "Le 3 janvier 2009, un inconnu sous le pseudonyme de Satoshi Nakamoto grave dans le premier bloc de Bitcoin un titre de journal qui n'épargne personne : le système bancaire vient d'être sauvé par les États. Ce geste fondateur ouvre une ère nouvelle, celle d'une monnaie électronique sans intermédiaire de confiance.\n\nDans cette quête inaugurale, tu poseras les fondations de tout ton apprentissage : comprendre ce qu'est Bitcoin, quel problème il résout et pourquoi la décentralisation change tout. Tu termineras en explorant un vrai bloc dans l'explorateur BitLab pour toucher du doigt la blockchain.",
    requiredLevel: 1,
    xpReward: 115,
    satsReward: 1000,
    missionType: "block_explorer",
    missionConfig: {},
    missionBrief:
      "Ouvre le Bloc #841 234 dans l'explorateur BitLab et relève son nombre de transactions, puis saisis les 6 derniers caractères du hash du bloc pour prouver ton exploration.",
    missionHint:
      "Dans l'explorateur, le nombre de transactions figure en haut du détail du bloc ; le hash complet est une longue suite de lettres et de chiffres, copie-en soigneusement la fin.",
    theorySections: [
      {
        title: "Qu'est-ce que Bitcoin ?",
        body: "Bitcoin est un système de monnaie électronique pair-à-pair, décrit par Satoshi Nakamoto dans son livre blanc publié le 31 octobre 2008. Il permet d'envoyer de la valeur à n'importe qui, partout dans le monde, sans passer par une banque ni aucun intermédiaire.\n\nSa force : aucun serveur central ne détient le pouvoir. Des milliers de nœuds répartis sur la planète vérifient chaque transaction et conservent une copie identique du registre public, la blockchain.",
        keypoints: [
          "Bitcoin est un réseau pair-à-pair sans autorité centrale.",
          "Le livre blanc de Satoshi Nakamoto paraît le 31 octobre 2008.",
          "La blockchain est un registre public répliqué sur des milliers de nœuds.",
          "Un bitcoin se divise en 100 millions de satoshis.",
        ],
      },
      {
        title: "Le problème de la double dépense",
        body: "Une donnée numérique se copie à l'infini : tu envoies un fichier, ton ami en garde une copie et toi aussi. Appliqué à la monnaie, ce comportement est catastrophique : comment empêcher quelqu'un de dépenser deux fois le même bitcoin ?\n\nAvant Bitcoin, la seule réponse était un tiers de confiance qui tient le registre et refuse les doublons. L'innovation de Satoshi consiste à résoudre la double dépense par une blockchain décentralisée, vérifiée collectivement par l'ensemble du réseau.",
        keypoints: [
          "La double dépense consiste à dépenser deux fois la même unité numérique.",
          "Les banques l'évitent grâce à un registre centralisé.",
          "Bitcoin la résout sans tiers de confiance, par consensus du réseau.",
          "Chaque transaction est vérifiée publiquement avant d'être confirmée.",
        ],
      },
      {
        title: "Le bloc genèse",
        body: "Le 3 janvier 2009, Satoshi mine le bloc numéro 0, dit bloc genèse, doté d'une récompense de 50 BTC. Il y inscrit le titre du Times du jour : « Chancellor on brink of second bailout for banks », une pique cinglante au système financier.\n\nCe message sert d'horodatage : le bloc ne peut pas avoir été miné avant cette date. Sa récompense de 50 BTC, codée d'une manière particulière, reste à jamais non dépensable, comme un monument figé dans le marbre du réseau.",
        keypoints: [
          "Le bloc genèse est miné le 3 janvier 2009.",
          "Il contient le titre du Times comme preuve d'horodatage.",
          "Sa récompense de 50 BTC est structurellement non dépensable.",
          "Il marque le lancement effectif du réseau Bitcoin.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "Quelle date correspond au minage du bloc genèse de Bitcoin ?",
        options: ["31 octobre 2008", "3 janvier 2009", "9 janvier 2010", "22 mai 2010"],
        correctIndex: 1,
        explanation:
          "Le 31 octobre 2008 correspond au livre blanc ; le bloc genèse, lui, est miné le 3 janvier 2009.",
      },
      {
        type: "MCQ",
        question: "Quel problème fondamental Bitcoin résout-il sans autorité centrale ?",
        options: [
          "La censure des e-mails",
          "Le vol de mots de passe",
          "La double dépense",
          "La lenteur du minage",
        ],
        correctIndex: 2,
        explanation:
          "La double dépense est le problème central du cash électronique ; Bitcoin le résout par consensus décentralisé, sans banque ni registre propriétaire.",
      },
      {
        type: "TRUE_FALSE",
        question: "La récompense de 50 BTC du bloc genèse peut être dépensée par quiconque la réclame.",
        options: [],
        correctBool: false,
        explanation:
          "La sortie de la transaction genèse n'entre jamais dans l'ensemble des UTXO : ces 50 BTC sont définitivement verrouillés, personne ne peut les dépenser.",
      },
      {
        type: "MCQ",
        question: "Quel message est gravé dans le bloc genèse ?",
        options: [
          "« The Times 03/Jan/2009 Chancellor on brink of second bailout for banks »",
          "« Bitcoin: A Peer-to-Peer Electronic Cash System »",
          "« We are the 99% »",
          "« In cryptography we trust »",
        ],
        correctIndex: 0,
        explanation:
          "Satoshi a inscrit le titre du Times du 3 janvier 2009, à la fois horodatage invérifiable avant cette date et critique du système bancaire.",
      },
    ],
  },
  {
    code: "keys",
    track: "INITIATION",
    order: 2,
    title: "Clés et Adresses",
    subtitle: "Forge ta souveraineté cryptographique",
    description:
      "Forge ta première paire de clés dans BitLab et comprends pourquoi « pas tes clés, pas tes bitcoins ».",
    intro:
      "Derrière chaque adresse Bitcoin se cache une paire de clés cryptographiques : une clé privée, secret absolu, et une clé publique, dérivée mathématiquement de la première. Ce duo permet de signer des transactions sans jamais révéler son secret.\n\nDans cette quête, tu découvriras la cryptographie asymétrique et les fonctions de hachage qui verrouillent le réseau. Tu mettras ensuite les mains dans la Forge de BitLab pour créer ta propre paire de clés et voir naître une adresse sous tes yeux.",
    requiredLevel: 1,
    xpReward: 115,
    satsReward: 1000,
    missionType: "key_forge",
    missionConfig: {},
    missionBrief:
      "Utilise la Forge de BitLab pour générer ta paire de clés : observe l'adresse produite, puis saisis ses 4 derniers caractères pour prouver que tu l'as forgée.",
    missionHint:
      "L'adresse est le résultat final de la chaîne de hachages : ce n'est ni la clé privée ni la clé publique affichées en premier.",
    theorySections: [
      {
        title: "Cryptographie asymétrique",
        body: "Bitcoin repose sur la cryptographie à courbes elliptiques : l'algorithme ECDSA appliqué à la courbe secp256k1. Ta clé privée est un nombre aléatoire gigantesque ; ta clé publique en est dérivée par multiplication sur la courbe, un calcul facile dans un sens et irréversible dans l'autre.\n\nSigner une transaction avec ta clé privée prouve que tu contrôles ces fonds sans les révéler. N'importe quel nœud vérifie la signature avec la seule clé publique.",
        keypoints: [
          "La clé privée est un nombre aléatoire à garder secret absolument.",
          "La clé publique se dérive de la clé privée par ECDSA sur secp256k1.",
          "Une signature prouve la possession de la clé sans la révéler.",
          "Retrouver la clé privée depuis la clé publique est impossible en pratique.",
        ],
      },
      {
        title: "Fonctions de hachage",
        body: "Une fonction de hachage transforme n'importe quelle donnée en une empreinte de taille fixe, en un sens unique : impossible de remonter de l'empreinte vers l'entrée. Bitcoin en utilise deux majeures, SHA-256 et RIPEMD-160.\n\nChanger un seul bit de l'entrée bouleverse entièrement la sortie : c'est l'effet avalanche. L'adresse naît de cette chaîne : SHA-256 de la clé publique, puis RIPEMD-160, puis un encodage lisible pour l'humain.",
        keypoints: [
          "SHA-256 produit une empreinte irréversible de 256 bits.",
          "RIPEMD-160 raccourcit l'empreinte à 160 bits pour l'adresse.",
          "Un hachage change totalement si l'entrée change d'un seul bit.",
          "L'adresse est un hachage de la clé publique, pas la clé elle-même.",
        ],
      },
      {
        title: "Seed phrase et souveraineté",
        body: "La seed phrase BIP39 est une suite de 12 ou 24 mots qui génère de façon déterministe toutes tes clés. Ces quelques mots suffisent à restaurer ton portefeuille complet sur n'importe quel appareil compatible.\n\nElle est donc ta vraie sauvegarde, et ta plus grande vulnérabilité : quiconque la lit contrôle tes fonds, et sa perte est irrémédiable. D'où la maxime du milieu : « not your keys, not your coins ». Écris-la sur papier ou métal, jamais dans un appareil connecté.",
        keypoints: [
          "Une seed phrase BIP39 contient 12 ou 24 mots dans un ordre précis.",
          "Elle dérive l'ensemble des clés privées du portefeuille.",
          "Sauvegarde-la hors ligne : papier ou métal, jamais de photo ni de cloud.",
          "Pas tes clés, pas tes bitcoins : sur une plateforme, tu détiens une promesse, pas des coins.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "Quelle courbe elliptique Bitcoin utilise-t-il pour les signatures ECDSA ?",
        options: ["Curve25519", "secp384r1", "secp256k1", "P-521"],
        correctIndex: 2,
        explanation:
          "Bitcoin a choisi secp256k1, une courbe aux propriétés bien étudiées ; les autres courbes citées appartiennent à d'autres systèmes cryptographiques.",
      },
      {
        type: "MCQ",
        question: "Dans quel ordre les hachages s'enchaînent-ils pour créer une adresse ?",
        options: [
          "RIPEMD-160 puis SHA-256",
          "SHA-256 appliqué deux fois",
          "RIPEMD-160 appliqué deux fois",
          "SHA-256 puis RIPEMD-160",
        ],
        correctIndex: 3,
        explanation:
          "On hache d'abord la clé publique avec SHA-256, puis le résultat avec RIPEMD-160 : cet ordre précis durcit l'analyse cryptographique.",
      },
      {
        type: "TRUE_FALSE",
        question:
          "Si tu perds ta seed phrase et ta clé privée, le support du réseau peut restaurer tes fonds.",
        options: [],
        correctBool: false,
        explanation:
          "Le réseau ne connaît ni ton identité ni de mot de passe réinitialisable : sans clé privée, les fonds sont perdus pour tout le monde, définitivement.",
      },
      {
        type: "MCQ",
        question: "Combien de mots contient une seed phrase BIP39 standard ?",
        options: ["12 ou 24", "6 ou 9", "16 ou 32", "Toujours 25"],
        correctIndex: 0,
        explanation:
          "La norme BIP39 définit des seed phrases de 12 ou 24 mots ; les autres longueurs ne correspondent à aucun standard Bitcoin.",
      },
    ],
  },
  {
    code: "tx-basics",
    track: "INITIATION",
    order: 3,
    title: "Anatomie d'une Transaction",
    subtitle: "Inputs, outputs, change et frais",
    description:
      "Assemble ta première transaction de 45 000 sats : sélection d'UTXO, change et vitesse de confirmation.",
    intro:
      "Une transaction Bitcoin n'est pas un simple virement de solde : c'est un mécanisme précis qui consomme des pièces existantes et en crée de nouvelles. Comprendre cette mécanique, c'est comprendre tout Bitcoin.\n\nDans cette quête, tu disséqueras l'anatomie d'une transaction : inputs, outputs, UTXO, change et frais. Ensuite, dans l'atelier de BitLab, tu construiras toi-même un paiement de 45 000 sats en choisissant tes pièces et ta vitesse de confirmation.",
    requiredLevel: 1,
    xpReward: 120,
    satsReward: 1500,
    missionType: "tx_builder",
    missionConfig: { variant: "payment", target: 45000, feeSats: { slow: 800, medium: 2000, fast: 5000 } },
    missionBrief:
      "Construis dans l'atelier de BitLab un paiement de 45 000 sats : sélectionne les UTXO nécessaires, choisis ta vitesse de confirmation, puis valide la transaction.",
    missionHint:
      "Tes UTXO doivent couvrir le montant cible ET les frais : si le change est impossible, la transaction sera refusée par l'atelier.",
    theorySections: [
      {
        title: "Inputs et outputs",
        body: "Chaque transaction consomme des entrées, les inputs, et produit des sorties, les outputs. Une input référence un UTXO reçu précédemment et le déverrouille grâce à une signature ; une output verrouille un montant vers un nouveau script.\n\nLes outputs non encore dépensées portent un nom : les UTXO, unspent transaction outputs. Le solde d'un portefeuille n'est donc pas un chiffre unique, mais la somme de ses UTXO éparpillés sur la blockchain.",
        keypoints: [
          "Une input référence un UTXO antérieur et le débloque par signature.",
          "Une output verrouille des satoshis vers un script de dépense.",
          "Le solde d'un portefeuille est la somme de ses UTXO.",
          "Chaque UTXO ne se dépense qu'une fois, en entier.",
        ],
      },
      {
        title: "Le change",
        body: "Impossible de dépenser un UTXO partiellement : si tu paies 15 000 sats avec une pièce de 100 000 sats, la transaction doit recréer une sortie de 85 000 sats vers ta propre adresse. C'est le change.\n\nRien ne se perd dans une transaction : la différence entre inputs et outputs devient les frais, collectés par le mineur qui inclut ta transaction dans son bloc.",
        keypoints: [
          "Un UTXO se consomme toujours intégralement.",
          "Le change renvoie l'excédent vers une adresse de ton portefeuille.",
          "frais = somme des inputs moins somme des outputs.",
          "Les frais rémunèrent le mineur qui confirme ta transaction.",
        ],
      },
      {
        title: "Vitesse et confirmations",
        body: "Une transaction n'est définitive qu'une fois confirmée dans un bloc. En moyenne, un nouveau bloc apparaît toutes les dix minutes, mais ce n'est qu'une moyenne : aucune garantie stricte n'existe à l'échelle d'une transaction.\n\nProposer des frais plus élevés incite les mineurs à te prioriser. Dans l'atelier BitLab, tu devras arbitrer : payer peu et attendre, ou payer davantage pour une inclusion rapide dans le prochain bloc.",
        keypoints: [
          "Un bloc est miné en moyenne toutes les 10 minutes.",
          "Une confirmation signifie que la transaction est incluse dans un bloc.",
          "Des frais plus élevés accélèrent généralement la confirmation.",
          "Six confirmations sont souvent jugées suffisantes pour des montants importants.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "Que devient la différence entre la somme des inputs et celle des outputs ?",
        options: [
          "Elle est rendue aux nœuds du réseau",
          "Elle constitue les frais perçus par le mineur",
          "Elle est brûlée définitivement",
          "Elle retourne au bloc genèse",
        ],
        correctIndex: 1,
        explanation:
          "frais = inputs moins outputs : cette différence est la rémunération du mineur qui inclut ta transaction dans son bloc.",
      },
      {
        type: "MCQ",
        question: "Que signifie UTXO ?",
        options: [
          "Unspent Transaction Output",
          "Unified Transfer eXchange Object",
          "User Transaction eXchange Order",
          "Universal Token Output",
        ],
        correctIndex: 0,
        explanation:
          "UTXO veut dire Unspent Transaction Output : une sortie de transaction non encore dépensée, la vraie unité de compte du modèle Bitcoin.",
      },
      {
        type: "TRUE_FALSE",
        question: "Un UTXO se dépense toujours en entier, jamais partiellement.",
        options: [],
        correctBool: true,
        explanation:
          "Exact : un UTXO se consomme intégralement ; l'excédent revient sous forme d'output de change vers ta propre adresse.",
      },
      {
        type: "MCQ",
        question: "En moyenne, combien de temps s'écoule entre deux blocs Bitcoin ?",
        options: ["2 minutes", "30 minutes", "1 heure", "10 minutes"],
        correctIndex: 3,
        explanation:
          "La difficulté est calibrée pour qu'un bloc soit miné toutes les dix minutes en moyenne, ni plus ni moins à long terme.",
      },
    ],
  },
  {
    code: "utxo",
    track: "INTERMEDIATE",
    order: 4,
    title: "Maîtrise des UTXO",
    subtitle: "Poussière, consolidation et empreinte",
    description:
      "Nettoie ton portefeuille : consolide tous tes petits UTXO en une seule pièce propre et économique.",
    intro:
      "À force de paiements, un portefeuille actif accumule des dizaines de petits UTXO, parfois appelés poussière. Chacun coûte cher à dépenser et révèle publiquement des informations sur tes habitudes.\n\nCette quête t'apprend à penser comme un logiciel de portefeuille : modèle UTXO, sélection de pièces, consolidation et confidentialité. Tu réaliseras ensuite une consolidation complète dans l'atelier de BitLab pour regrouper ta poussière en un UTXO unique.",
    requiredLevel: 2,
    xpReward: 120,
    satsReward: 2000,
    missionType: "tx_builder",
    missionConfig: { variant: "consolidation", feeSats: { slow: 1200, medium: 3000, fast: 7500 } },
    missionBrief:
      "Consolide dans l'atelier de BitLab l'intégralité de tes petits UTXO en un seul output : sélectionne-les tous et valide la consolidation en une transaction unique.",
    missionHint:
      "Vérifie que le total de tes UTXO couvre les frais de consolidation : aucun UTXO ne doit rester de côté.",
    theorySections: [
      {
        title: "UTXO contre modèle compte",
        body: "Ethereum suit un modèle de comptes, à la manière d'un relevé bancaire : chaque adresse possède un solde. Bitcoin choisit l'inverse avec le modèle UTXO : il n'existe aucun solde, seulement des pièces non dépensées référencées par la transaction qui les a créées.\n\nCe design rend la validation auditable et parallélisable : chaque nœud peut reconstruire l'ensemble des UTXO et vérifier qu'aucune pièce n'apparaît de nulle part.",
        keypoints: [
          "Bitcoin ne stocke aucun solde : seulement des UTXO.",
          "Le modèle compte centralise l'état par adresse, comme Ethereum.",
          "L'UTXO set est l'état global maintenu par chaque nœud.",
          "Chaque satoshi reste traçable jusqu'à sa transaction d'origine.",
        ],
      },
      {
        title: "La sélection de pièces",
        body: "Choisir quels UTXO dépenser s'appelle la sélection de pièces, ou coin selection. Un bon algorithme minimise les frais, car moins d'inputs signifie une transaction plus légère, et protège la vie privée.\n\nL'algorithme branch-and-bound cherche par exemple l'ensemble exact d'UTXO permettant d'éviter une sortie de change, car un change lie publiquement deux adresses du même portefeuille aux yeux de n'importe quel analyste de chaîne.",
        keypoints: [
          "Plus d'inputs signifie plus de vBytes et donc plus de frais.",
          "Branch-and-bound vise une transaction sans sortie de change.",
          "Un change révèle que deux adresses appartiennent au même portefeuille.",
          "Les portefeuilles modernes choisissent les UTXO automatiquement mais prudemment.",
        ],
      },
      {
        title: "Consolider sans se trahir",
        body: "Consolider, c'est regrouper plusieurs petits UTXO en un seul, en se payant soi-même. Cela simplifie les paiements futurs et économise des frais à long terme, surtout quand le mempool est calme.\n\nMais chaque consolidation fusionne des historiques et révèle sur la chaîne que toutes ces adresses sont liées. Les utilisateurs avertis consolident pendant les périodes de frais bas et séparent soigneusement leurs fonds sensibles de leurs fonds quotidiens.",
        keypoints: [
          "La consolidation réduit une poussière coûteuse à dépenser plus tard.",
          "Elle est la plus rentable quand les frais de réseau sont bas.",
          "Elle lie publiquement toutes les adresses consolidées.",
          "Isole tes UTXO sensibles avant toute consolidation.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "Pourquoi une sortie de change trahit-elle une information ?",
        options: [
          "Elle indique ton adresse IP au mineur",
          "Elle lie publiquement deux adresses du même portefeuille",
          "Elle double les frais de la transaction",
          "Elle bloque le réseau dix minutes",
        ],
        correctIndex: 1,
        explanation:
          "Un change rattaché au même portefeuille révèle que les deux adresses ont le même propriétaire : c'est une heuristique classique d'analyse de chaîne.",
      },
      {
        type: "MCQ",
        question: "Quel est l'intérêt principal de consolider ses UTXO ?",
        options: [
          "Gagner des satoshis automatiquement",
          "Anonymiser complètement les fonds",
          "Réduire les frais futurs et simplifier les paiements",
          "Augmenter la vitesse du réseau",
        ],
        correctIndex: 2,
        explanation:
          "Une consolidation regroupe la poussière : les futurs paiements demandent moins d'inputs, donc moins de vBytes et moins de frais.",
      },
      {
        type: "TRUE_FALSE",
        question: "Le modèle UTXO de Bitcoin enregistre directement un solde par adresse.",
        options: [],
        correctBool: false,
        explanation:
          "Bitcoin ne connaît que des pièces non dépensées : le solde apparent se calcule en sommant les UTXO contrôlés par le portefeuille.",
      },
      {
        type: "MCQ",
        question: "Que désigne le terme dust dans l'écosystème Bitcoin ?",
        options: [
          "Des frais de minage obsolètes",
          "Une adresse invalide",
          "Un bloc vide de transactions",
          "Des UTXO si petits qu'ils coûtent plus à dépenser qu'ils ne valent",
        ],
        correctIndex: 3,
        explanation:
          "La poussière désigne des UTXO minuscules dont les frais de dépense dépassent leur valeur : un fardeau pour le portefeuille.",
      },
    ],
  },
  {
    code: "fees-mempool",
    track: "INTERMEDIATE",
    order: 5,
    title: "Frais et Mempool",
    subtitle: "Le marché invisible des frais",
    description:
      "Calcule des vBytes, choisis ton taux sats/vByte et deviens un sniper du mempool congestionné.",
    intro:
      "Quand le réseau s'emballe, les frais grimpent et une transaction sous-payée peut rester bloquée des heures. Comprendre le mempool et le calcul des frais devient alors une compétence de survie.\n\nTu apprendras ici à mesurer une transaction en vBytes, à fixer un taux de frais et à manier les deux soupapes de secours : RBF et CPFP. Puis tu affronteras un mempool congestionné dans l'atelier de BitLab, calculatrice en main.",
    requiredLevel: 2,
    xpReward: 120,
    satsReward: 2000,
    missionType: "tx_builder",
    missionConfig: { variant: "fee_opt", vbytes: 250, feeRates: { slow: 5, medium: 25, fast: 80 } },
    missionBrief:
      "Le mempool est congestionné : choisis dans l'atelier de BitLab la vitesse qui confirmera ta transaction de 250 vBytes dans le prochain bloc, puis calcule et saisis les frais totaux correspondants.",
    missionHint:
      "Applique la formule frais = vBytes multiplié par le taux du palier choisi ; un taux de 80 sats/vByte sur 250 vBytes se calcule vite.",
    theorySections: [
      {
        title: "vBytes et taux de frais",
        body: "La taille d'une transaction se mesure en unités virtuelles, les vBytes, qui pondèrent les données selon leur poids. Une input SegWit pèse environ 68 vBytes, une output classique environ 31 vBytes : c'est la structure qui coûte, pas le montant.\n\nLe taux de frais s'exprime en satoshis par vByte. Une transaction de 250 vBytes au taux de 10 sats/vByte coûte donc 2 500 sats, qu'elle transfère 100 000 sats ou un milliard.",
        keypoints: [
          "Le taux de frais se mesure en sats/vByte.",
          "frais totaux = taille en vBytes multipliée par le taux.",
          "Une input SegWit pèse environ 68 vBytes, une output environ 31.",
          "Le montant transféré n'influence pas les frais.",
        ],
      },
      {
        title: "Le mempool",
        body: "Le mempool est la salle d'attente du réseau : l'ensemble des transactions valides en attente d'inclusion, conservé par chaque nœud. Quand la demande dépasse la capacité des blocs, les mineurs trient et commencent par les taux de frais les plus élevés.\n\nIl en résulte une enchère permanente : plus le mempool est plein, plus il faut payer pour passer devant. Les transactions trop économiques restent en attente, parfois des heures, voire finissent éjectées.",
        keypoints: [
          "Le mempool contient les transactions en attente de confirmation.",
          "Les mineurs remplissent chaque bloc par taux de frais décroissant.",
          "La capacité du réseau se limite à quelques transactions par seconde.",
          "Une transaction sous-payée reste bloquée ou finit éjectée du mempool.",
        ],
      },
      {
        title: "RBF et CPFP",
        body: "Replace-By-Fee (RBF) est la soupape de l'expéditeur : tant que la transaction n'est pas confirmée, il la remplace par une version aux frais majorés, signalée dès l'origine.\n\nChild-Pays-For-Parent (CPFP) est la parade du destinataire : il dépense l'UTXO encore bloqué dans une transaction enfant aux frais élevés, poussant les mineurs à inclure le couple entier. Dans les deux cas, c'est le taux global du paquet qui décide.",
        keypoints: [
          "RBF : l'expéditeur augmente les frais d'une tx non confirmée.",
          "CPFP : le destinataire crée une transaction enfant aux frais élevés.",
          "Les mineurs évaluent le taux combiné d'un paquet parent-enfant.",
          "Le remplacement RBF doit être signalé par la transaction d'origine.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "Combien coûte une transaction de 250 vBytes au taux de 25 sats/vByte ?",
        options: ["625 sats", "2 500 sats", "6 250 sats", "250 sats"],
        correctIndex: 2,
        explanation:
          "frais = 250 × 25 = 6 250 sats ; la formule à retenir est taille en vBytes multipliée par le taux.",
      },
      {
        type: "MCQ",
        question: "Que permet exactement RBF ?",
        options: [
          "Annuler définitivement une transaction",
          "Forcer un mineur à inclure la tx",
          "Doubler la capacité des blocs",
          "Remplacer une tx non confirmée par une version mieux payée",
        ],
        correctIndex: 3,
        explanation:
          "RBF autorise l'expéditeur à diffuser une nouvelle version de sa transaction, aux frais majorés, tant qu'elle n'est pas confirmée.",
      },
      {
        type: "TRUE_FALSE",
        question: "Le montant en satoshis d'une transaction détermine directement ses frais.",
        options: [],
        correctBool: false,
        explanation:
          "Les frais dépendent de la taille en vBytes et du taux de marché ; le montant transféré n'y change rien.",
      },
      {
        type: "MCQ",
        question: "Comment fonctionne CPFP ?",
        options: [
          "Le parent paie pour son enfant",
          "Une transaction enfant aux frais élevés motive l'inclusion du parent",
          "Le mineur rembourse la différence de frais",
          "Le réseau fusionne deux mempools",
        ],
        correctIndex: 1,
        explanation:
          "En dépensant l'UTXO bloqué avec des frais élevés, la transaction enfant rend le paquet parent-enfant attractif pour les mineurs.",
      },
    ],
  },
  {
    code: "mining",
    track: "INTERMEDIATE",
    order: 6,
    title: "Minage et Consensus",
    subtitle: "Proof of Work, nonce et consensus",
    description:
      "Cherche à la main le nonce qui rend ton hash valide et ressens la difficulté du Proof of Work.",
    intro:
      "Le minage est le cœur battant de Bitcoin : sans lui, pas d'horodatage fiable, pas de protection contre la double dépense, pas d'émission contrôlée des nouvelles pièces.\n\nTu découvriras ici comment le Proof of Work transforme l'électricité en sécurité, comment la difficulté s'ajuste toute seule et ce que devient la récompense des mineurs. Puis tu mineras un bloc dans le simulateur de BitLab, en cherchant le bon nonce à la force de tes doigts.",
    requiredLevel: 3,
    xpReward: 125,
    satsReward: 2500,
    missionType: "mine_nonce",
    missionConfig: { difficulty: "000", maxNonce: 60000 },
    missionBrief:
      "Mine un bloc dans le simulateur de BitLab : trouve le nonce dont le hash commence par « 000 », dans la limite de 60 000 essais.",
    missionHint:
      "Incrémente le nonce méthodiquement et observe les hash produits : les zéros initiaux sont rares, chaque essai compte.",
    theorySections: [
      {
        title: "Le Proof of Work",
        body: "Miner consiste à trouver un nonce tel que le hachage SHA-256 du bloc candidat tombe sous une cible : concrètement, un hash commençant par un certain nombre de zéros. Aucune astuce n'existe : il faut essayer encore et encore.\n\nCette dépense d'énergie rend la fraude économiquement absurde : réécrire le passé exigerait de refaire tout le travail des blocs suivants, plus vite que l'ensemble du réseau mondial.",
        keypoints: [
          "Le nonce est un compteur que le mineur incrémente à chaque essai.",
          "Un hash valide doit être inférieur à la cible de difficulté.",
          "La difficulté réelle impose des milliards de milliards d'essais.",
          "Réécrire l'historique coûterait plus cher que de miner honnêtement.",
        ],
      },
      {
        title: "Difficulté et ajustement",
        body: "Tous les 2 016 blocs, soit environ deux semaines, le réseau recalcule sa difficulté pour maintenir un intervalle moyen de dix minutes entre deux blocs.\n\nSi la puissance de calcul mondiale grimpe, la difficulté augmente ; si elle s'effondre, elle diminue. Le système s'auto-équilibre sans aucune autorité : la nouvelle cible se dérive automatiquement des horodatages des derniers 2 016 blocs.",
        keypoints: [
          "La difficulté s'ajuste tous les 2 016 blocs, environ 2 semaines.",
          "L'objectif reste un bloc en moyenne toutes les 10 minutes.",
          "Plus de hashrate mondial entraîne une difficulté accrue.",
          "Aucune autorité ne décide : l'ajustement est une règle automatique.",
        ],
      },
      {
        title: "Récompense et halving",
        body: "Le mineur qui valide un bloc encaisse la subvention de bloc ainsi que les frais des transactions incluses. La subvention démarre à 50 BTC et est divisée par deux tous les 210 000 blocs.\n\nDepuis le halving d'avril 2024, elle s'élève à 3,125 BTC. Cette émission dégressive plafonne l'offre totale à 21 millions de bitcoins, le dernier satoshi devant être extrait vers l'année 2140.",
        keypoints: [
          "La récompense de bloc est de 3,125 BTC depuis avril 2024.",
          "Le halving survient tous les 210 000 blocs, environ tous les 4 ans.",
          "L'offre totale est plafonnée à 21 millions de BTC.",
          "Les frais de transaction complètent la subvention du mineur.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "À quoi sert le nonce dans le minage ?",
        options: [
          "Chiffrer les transactions du bloc",
          "Faire varier le hash du candidat jusqu'à trouver un hash valide",
          "Signer la récompense du mineur",
          "Distribuer les frais aux nœuds",
        ],
        correctIndex: 1,
        explanation:
          "En changeant le nonce, le mineur obtient un hash totalement différent : il cherche celui qui tombe sous la cible de difficulté.",
      },
      {
        type: "MCQ",
        question: "Tous les combien de blocs la difficulté est-elle recalculée ?",
        options: ["210 000", "144", "2 016", "10"],
        correctIndex: 2,
        explanation:
          "Le réajustement intervient tous les 2 016 blocs, soit environ deux semaines ; les 210 000 blocs concernent le halving.",
      },
      {
        type: "TRUE_FALSE",
        question: "Depuis le halving d'avril 2024, la récompense de bloc s'élève à 3,125 BTC.",
        options: [],
        correctBool: true,
        explanation:
          "Après 50, 25, 12,5 puis 6,25 BTC, le quatrième halving d'avril 2024 a fixé la subvention à 3,125 BTC.",
      },
      {
        type: "MCQ",
        question: "Que se passe-t-il si le hashrate mondial chute brutalement ?",
        options: [
          "La difficulté baisse au prochain ajustement",
          "Les blocs ralentissent durablement",
          "Le réseau suspend l'émission des BTC",
          "La récompense augmente automatiquement",
        ],
        correctIndex: 0,
        explanation:
          "L'ajustement tous les 2 016 blocs ramène l'intervalle à dix minutes en baissant la difficulté quand le hashrate diminue.",
      },
    ],
  },
  {
    code: "lightning",
    track: "ADVANCED",
    order: 7,
    title: "Explorer le Lightning Network",
    subtitle: "Paiements instantanés hors chaîne",
    description:
      "Ouvre ton premier canal Lightning dans BitLab : choisis ton pair et ta capacité comme un opérateur.",
    intro:
      "La blockchain Bitcoin confirme en moyenne toutes les dix minutes : comment payer un café en deux secondes dans ces conditions ? La réponse du réseau s'appelle le Lightning Network, une seconde couche de paiements instantanés construite au-dessus de Bitcoin.\n\nTu apprendras ici comment des canaux verrouillent des fonds on-chain pour permettre des échanges instantanés off-chain, et comment le réseau route les paiements entre inconnus. Puis tu ouvriras ton propre canal dans BitLab.",
    requiredLevel: 4,
    xpReward: 130,
    satsReward: 3000,
    missionType: "ln_channel",
    missionConfig: {},
    missionBrief:
      "Ouvre un canal Lightning dans BitLab : choisis un pair parmi ceux proposés et détermine une capacité adaptée à tes futurs paiements, puis valide l'ouverture.",
    missionHint:
      "Un pair bien connecté t'apporte de la capacité entrante : tu pourras ainsi recevoir des paiements sans canal dédié.",
    theorySections: [
      {
        title: "Les canaux de paiement",
        body: "Ouvrir un canal revient à publier une transaction on-chain, la funding transaction, qui verrouille des fonds dans un multisig 2-de-2 entre toi et ton pair. Ce montant constitue la capacité du canal.\n\nEnsuite, les deux parties échangent des transactions d'engagement, les commitment transactions, mises à jour à chaque paiement mais jamais publiées. Seule la fermeture du canal inscrit le solde final sur la blockchain.",
        keypoints: [
          "La funding transaction verrouille les fonds du canal on-chain.",
          "La capacité est la somme totale de satoshis verrouillée.",
          "Les commitment transactions reflètent le solde de chacun après chaque paiement.",
          "Seules l'ouverture et la fermeture laissent une trace on-chain.",
        ],
      },
      {
        title: "Routage et HTLC",
        body: "Pas besoin d'un canal direct avec chaque marchand : le réseau route les paiements de nœud en nœud grâce aux HTLC, les Hash Time Locked Contracts.\n\nUn HTLC exige la révélation d'un preimage, l'image du payment hash, avant une échéance ; sinon les fonds reviennent à l'expéditeur. Ce mécanisme garantit l'atomicité du trajet : soit le paiement traverse tous les sauts, soit rien ne bouge. Chaque intermédiaire prélève une commission minime.",
        keypoints: [
          "Un paiement peut traverser plusieurs canaux : c'est le routage multi-hops.",
          "Les HTLC garantissent l'atomicité : tout le trajet ou rien.",
          "La révélation du preimage prouve que le paiement est arrivé.",
          "Les nœuds intermédiaires facturent quelques satoshis de routage.",
        ],
      },
      {
        title: "Forces et limites",
        body: "Lightning règle les paiements en quelques millisecondes, avec des frais quasi nuls, et permet même des montants inférieurs au satoshi, impossibles on-chain. C'est l'outil idéal du commerce quotidien et du micro-paiement.\n\nEn contrepartie, gérer ses canaux demande de l'attention : liquidité entrante, sauvegardes d'états, disponibilité du nœud. Pour recevoir facilement des paiements, il faut de la capacité entrante, souvent obtenue en ouvrant des canaux vers des nœuds bien connectés.",
        keypoints: [
          "Les paiements Lightning se règlent en moins d'une seconde.",
          "Les frais de routage se comptent en fractions de satoshi.",
          "Recevoir des paiements exige de la capacité entrante.",
          "Lightning complète la chaîne : tout solde finit ancré dans Bitcoin.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "Quel type de transaction ouvre un canal Lightning ?",
        options: [
          "Une funding transaction multisig 2-de-2",
          "Une transaction coinbase",
          "Un HTLC de fermeture",
          "Un OP_RETURN anonyme",
        ],
        correctIndex: 0,
        explanation:
          "La funding transaction verrouille les fonds des deux participants dans un multisig 2-de-2 : elle ouvre officiellement le canal.",
      },
      {
        type: "MCQ",
        question: "Que se passe-t-il si le preimage n'est pas révélé avant l'échéance du HTLC ?",
        options: [
          "Le paiement devient définitif",
          "Les fonds retournent à l'expéditeur",
          "Le canal double sa capacité",
          "Le nœud est banni du réseau",
        ],
        correctIndex: 1,
        explanation:
          "Le HTLC est timelocké : sans preimage avant l'échéance, les fonds verrouillés reprennent le chemin inverse vers l'expéditeur.",
      },
      {
        type: "TRUE_FALSE",
        question: "Pour payer un marchand sur Lightning, tu dois ouvrir un canal direct avec lui.",
        options: [],
        correctBool: false,
        explanation:
          "Le réseau route ton paiement à travers plusieurs canaux intermédiaires : un canal direct avec le marchand n'est pas nécessaire.",
      },
      {
        type: "MCQ",
        question: "Qu'est-ce que la capacité d'un canal ?",
        options: [
          "Le nombre de canaux du pair",
          "Le nombre maximum de paiements",
          "La vitesse du nœud",
          "La somme totale de satoshis verrouillée à l'ouverture",
        ],
        correctIndex: 3,
        explanation:
          "La capacité est le montant total verrouillé dans la funding transaction, partagé entre les deux extrémités du canal.",
      },
    ],
  },
  {
    code: "lightning-invoice",
    track: "ADVANCED",
    order: 8,
    title: "Factures Lightning",
    subtitle: "BOLT11 et l'art d'être payé",
    description:
      "Décode une facture BOLT11 dans BitLab : montant, expiration et payment hash n'auront plus de secret.",
    intro:
      "Sur Lightning, personne ne t'envoie son numéro de compte : le destinataire génère une facture auto-descriptive, la fameuse invoice BOLT11, que l'expéditeur paie en un seul clic.\n\nTu apprendras ici à lire la structure de ces factures : montant en satoshis, délai d'expiration, payment hash et description. Puis tu décoderas une vraie facture dans BitLab pour en extraire les informations clés avant de payer.",
    requiredLevel: 4,
    xpReward: 120,
    satsReward: 3000,
    missionType: "ln_invoice",
    missionConfig: { amountSats: 25000, expiry: 3600 },
    missionBrief:
      "Décode dans BitLab la facture BOLT11 affichée : relève le montant en satoshis et la durée d'expiration, puis saisis ces deux valeurs pour valider ta lecture.",
    missionHint:
      "L'expiration s'exprime en secondes, pas en heures : une facture valable une heure affiche 3 600.",
    theorySections: [
      {
        title: "Anatomie d'une BOLT11",
        body: "Une invoice Lightning commence par le préfixe lnbc, pour Lightning Bitcoin mainnet, et encode tout ce qu'il faut pour payer : le montant en satoshis, le payment hash, une description et l'identité du nœud destinataire.\n\nLe tout est signé par la clé du destinataire : impossible de falsifier le montant sans invalider la facture. L'expéditeur n'a rien à saisir : il scanne le QR code et paie.",
        keypoints: [
          "Le préfixe lnbc identifie une facture Lightning sur le mainnet Bitcoin.",
          "Le montant est encodé directement dans la facture.",
          "La facture est signée par le destinataire, donc infalsifiable.",
          "Un QR code suffit pour initier le paiement.",
        ],
      },
      {
        title: "Payment hash et preimage",
        body: "La facture contient un payment hash : le SHA-256 d'une valeur secrète, le preimage, que seul le destinataire connaît au départ.\n\nPour recevoir les fonds, le destinataire doit révéler ce preimage le long du chemin de routage. Cette révélation prouve le paiement à chaque saut et assure l'atomicité. Le preimage joue ainsi le rôle de reçu cryptographique incontestable, vérifiable par tous.",
        keypoints: [
          "Le payment hash est le SHA-256 du preimage secret.",
          "Révéler le preimage débloque les fonds de chaque HTLC.",
          "Le preimage sert de preuve de paiement incontestable.",
          "Sans preimage avant l'échéance, les fonds retournent à l'expéditeur.",
        ],
      },
      {
        title: "Expiration et usage unique",
        body: "Chaque facture porte une durée de validité, souvent 3 600 secondes, soit une heure. Passé ce délai, la facture ne doit plus être honorée : le contexte du paiement a expiré.\n\nChaque BOLT11 est aussi à usage unique, pour préserver la confidentialité des paiements. Pour un point de paiement réutilisable, le protocole propose LNURL, qui négocie une facture fraîche à chaque demande.",
        keypoints: [
          "L'expiration par défaut d'une BOLT11 est souvent d'une heure, soit 3 600 secondes.",
          "Une facture expirée ne doit plus être payée.",
          "Chaque facture est à usage unique pour préserver la confidentialité.",
          "LNURL fournit des identifiants de paiement réutilisables.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "Que signifie le préfixe lnbc d'une facture Lightning ?",
        options: ["Lightning testnet", "Lightning Bitcoin mainnet", "Ln Big Currency", "Lightning Cash"],
        correctIndex: 1,
        explanation:
          "lnbc associe Lightning, la monnaie Bitcoin et le réseau principal ; un préfixe lntb désignerait le testnet.",
      },
      {
        type: "MCQ",
        question: "Quel rôle joue le preimage dans un paiement Lightning ?",
        options: [
          "Il prouve le paiement en débloquant le payment hash",
          "Il chiffre le canal de bout en bout",
          "Il stocke la description de la facture",
          "Il prolonge l'expiration",
        ],
        correctIndex: 0,
        explanation:
          "Le preimage est la préimage du payment hash : sa révélation débloque chaque HTLC et prouve que le paiement a abouti.",
      },
      {
        type: "TRUE_FALSE",
        question: "Une facture BOLT11 peut être payée plusieurs fois tant qu'elle n'a pas expiré.",
        options: [],
        correctBool: false,
        explanation:
          "Chaque facture est à usage unique : elle correspond à un paiement précis, puis le destinataire en émet une nouvelle.",
      },
      {
        type: "MCQ",
        question: "Que contient obligatoirement une invoice BOLT11 ?",
        options: [
          "Le nom du destinataire et son solde",
          "La liste complète des nœuds du trajet",
          "Le montant, le payment hash et la clé publique du destinataire",
          "La clé privée de l'expéditeur",
        ],
        correctIndex: 2,
        explanation:
          "Une BOLT11 embarque le montant, le payment hash, la clé du nœud destinataire et une signature ; le trajet, lui, se décide au moment du paiement.",
      },
    ],
  },
  {
    code: "multisig",
    track: "ADVANCED",
    order: 9,
    title: "Multisig & Sécurité",
    subtitle: "Coffres-forts numériques m-de-n",
    description:
      "Signe une transaction 2-de-3 dans BitLab et découvre l'architecture des coffres des professionnels.",
    intro:
      "Une clé privée perdue ou volée, et tout s'envole. Le multisig propose une réponse d'architecte : exiger plusieurs signatures issues de clés distinctes pour pouvoir dépenser.\n\nTu apprendras ici comment fonctionnent les politiques m-de-n, à quoi sert un PSBT et comment les professionnels sécurisent des trésors avec des coffres collaboratifs. Puis tu signeras une transaction 2-de-3 dans BitLab, en choisissant tes signataires avec soin.",
    requiredLevel: 5,
    xpReward: 120,
    satsReward: 3000,
    missionType: "multisig_sign",
    missionConfig: { policy: "2-of-3" },
    missionBrief:
      "Signe dans BitLab la transaction du coffre 2-de-3 : sélectionne exactement 2 signataires parmi les 3 disponibles et appose leurs signatures.",
    missionHint:
      "Deux signatures suffisent, trois ne sont pas nécessaires : choisis les signataires réellement accessibles, pas forcément les premiers de la liste.",
    theorySections: [
      {
        title: "Les scripts m-de-n",
        body: "Un multisig m-de-n exige m signatures parmi n clés configurées. Un 1-de-2 laisse l'un ou l'autre dépenser ; un 2-de-3 impose un consensus de deux clés sur trois ; un 3-de-5 évoque le quorum d'un conseil d'administration.\n\nHistoriquement implémenté en P2SH, le multisig s'écrit aujourd'hui aussi en P2WSH et en Taproot. Chaque configuration est un arbitrage entre sécurité renforcée et disponibilité des fonds.",
        keypoints: [
          "m-de-n : m signatures requises parmi n clés publiques.",
          "Le 2-de-3 tolère la perte ou la panne d'une clé.",
          "P2WSH hache le script entier avec SHA-256.",
          "Trop de clés alourdit la transaction et augmente les frais.",
        ],
      },
      {
        title: "PSBT et collaboration",
        body: "Le PSBT, pour Partially Signed Bitcoin Transaction, est le format standard qui transporte une transaction partiellement signée d'appareil en appareil, ou de copropriétaire en copropriétaire.\n\nChaque participant ouvre le PSBT, vérifie les montants et les adresses, ajoute sa signature, puis repasse le fichier, parfois par QR codes successifs. La transaction ne devient valide et diffusable qu'une fois le quorum de m signatures atteint.",
        keypoints: [
          "PSBT : Partially Signed Bitcoin Transaction, normalisé par le BIP174.",
          "Chaque signataire vérifie la transaction avant d'ajouter sa signature.",
          "La diffusion n'intervient qu'une fois le quorum m atteint.",
          "Les coffres collaboratifs automatisent cet échange de signatures.",
        ],
      },
      {
        title: "Cold storage et bonnes pratiques",
        body: "Le sommet de la sécurité : un multisig 2-de-3 dont les clés vivent sur trois appareils distincts, hors ligne, répartis dans des lieux différents. Un cambriolage, un incendie ou une panne ne suffisent plus à tout perdre.\n\nAttention cependant : la complexité ajoute des risques d'erreur humaine, et une sauvegarde complète exige les seeds ET la configuration du portefeuille. Commence simple, teste chaque scénario de récupération, puis monte en puissance.",
        keypoints: [
          "Le multisig protège contre la perte ou le vol d'une clé unique.",
          "Les clés se répartissent sur des appareils et des lieux séparés.",
          "Sauvegarde les seeds ET la configuration complète du coffre.",
          "Tester la récupération vaut autant que le montage initial.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "Que signifie une politique 2-de-3 ?",
        options: [
          "3 signatures requises sur 2 clés",
          "2 signatures requises parmi 3 clés",
          "2 clés perdues sur 3",
          "Un minimum de 3 personnes",
        ],
        correctIndex: 1,
        explanation:
          "Dans un 2-de-3, deux signatures suffisent pour dépenser et la troisième clé sert de secours en cas de perte ou de panne.",
      },
      {
        type: "MCQ",
        question: "À quoi sert un PSBT ?",
        options: [
          "Transporter une transaction partiellement signée entre signataires",
          "Accélérer le minage des blocs",
          "Stocker la seed phrase en sécurité",
          "Chiffrer le mempool du réseau",
        ],
        correctIndex: 0,
        explanation:
          "Le PSBT circule entre les copropriétaires, qui y ajoutent leurs signatures successives jusqu'à atteindre le quorum.",
      },
      {
        type: "TRUE_FALSE",
        question: "Un coffre 2-de-3 devient inutilisable si une seule des trois clés est perdue.",
        options: [],
        correctBool: false,
        explanation:
          "Deux clés sur trois suffisent : la perte d'une clé est tolérée, à condition de conserver les deux autres et leurs seeds.",
      },
      {
        type: "MCQ",
        question: "Pourquoi répartir les clés d'un multisig en plusieurs lieux ?",
        options: [
          "Pour payer moins de frais de réseau",
          "Pour doubler la capacité d'un canal",
          "Pour accélérer les confirmations",
          "Pour éviter qu'un sinistre ou un vol n'emporte toutes les clés",
        ],
        correctIndex: 3,
        explanation:
          "La séparation géographique protège contre l'incendie, le vol ou la panne simultanée : aucun sinistre local ne détruit toutes les clés.",
      },
    ],
  },
  {
    code: "taproot",
    track: "ADVANCED",
    order: 10,
    title: "Taproot et le Futur",
    subtitle: "Schnorr, MAST et discrétion",
    description:
      "Reconnaît une sortie Taproot correctement tweakée et comprends l'upgrade qui a rendu Bitcoin plus discret.",
    intro:
      "En novembre 2021, Bitcoin a activé sa plus grande évolution depuis SegWit : Taproot. Derrière ce nom botanique se cachent les signatures Schnorr, le MAST et une confidentialité renforcée pour les contrats complexes.\n\nTu apprendras ici comment Taproot allège les transactions, masque les contrats et ouvre de nouveaux usages. Puis tu affûteras ton œil dans BitLab pour identifier la sortie Taproot correctement tweakée parmi des imitations bien déguisées.",
    requiredLevel: 5,
    xpReward: 120,
    satsReward: 3500,
    missionType: "taproot_tweak",
    missionConfig: {},
    missionBrief:
      "Identifie dans BitLab la sortie Taproot correctement tweakée parmi les candidates proposées : analyse la structure de chaque clé puis sélectionne la bonne.",
    missionHint:
      "Une sortie P2TR authentique n'expose jamais ses branches de script en clair : méfie-toi des candidates trop bavardes.",
    theorySections: [
      {
        title: "L'upgrade Taproot",
        body: "Taproot réunit trois propositions complémentaires : les signatures Schnorr (BIP340), le mécanisme Taproot (BIP341) et TapScript (BIP342). L'ensemble s'est activé le 14 novembre 2021, au bloc 709 632.\n\nSon ambition : rendre les contrats complexes indiscernables des paiements ordinaires, tout en allégeant les données on-chain et en élargissant les possibilités du langage de script. Depuis, les adresses P2TR, commençant par bc1p, côtoient les formats classiques sans friction.",
        keypoints: [
          "Taproot active les signatures Schnorr, normalisées par le BIP340.",
          "L'activation intervient au bloc 709 632, en novembre 2021.",
          "TapScript étend le langage de script pour les dépenses avancées.",
          "Objectif : efficacité, flexibilité et confidentialité accrue.",
        ],
      },
      {
        title: "Signatures Schnorr",
        body: "Les signatures Schnorr sont élégantes, mathématiquement simples et surtout linéaires : deux signatures peuvent se combiner en une seule, valide pour une clé agrégée.\n\nCette propriété ouvre la voie à l'agrégation de clés : un multisig de dix participants peut apparaître on-chain comme une simple signature unique. Résultat : moins de données, moins de frais, et une confidentialité renforcée pour tous les utilisateurs.",
        keypoints: [
          "Schnorr se prouve plus simplement que ECDSA.",
          "La linéarité permet d'agréger plusieurs signatures en une seule.",
          "Un multisig n-de-n ressemble on-chain à un paiement ordinaire.",
          "Moins d'octets publiés signifie aussi des frais réduits.",
        ],
      },
      {
        title: "Key path, script path et MAST",
        body: "Une sortie Taproot contient une clé publique interne tweakée. La dépense standard emprunte le key path : une simple signature sur la clé finale, indiscernable d'un paiement ordinaire.\n\nÀ défaut, le script path révèle uniquement la branche de contrat exécutée, accompagnée de sa preuve de Merkle. Les autres branches du MAST restent cachées : un contrat à dix conditions n'expose que celle réellement utilisée.",
        keypoints: [
          "Key path : une dépense par simple signature, comme un paiement normal.",
          "Script path : révélation et exécution d'une seule branche du contrat.",
          "MAST désigne les Merkleized Abstract Syntax Trees.",
          "Les branches non utilisées restent confidentielles sur la chaîne.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "Quel type de signatures Taproot introduit-il dans Bitcoin ?",
        options: ["EdDSA", "Schnorr", "RSA", "DSA classique"],
        correctIndex: 1,
        explanation:
          "Le BIP340 normalise les signatures Schnorr, plus simples et linéaires, qui remplacent ECDSA pour les dépenses Taproot.",
      },
      {
        type: "MCQ",
        question: "Que permet la linéarité des signatures Schnorr ?",
        options: [
          "De miner plus vite",
          "De doubler la taille des blocs",
          "D'agréger plusieurs signatures en une seule",
          "De supprimer les frais",
        ],
        correctIndex: 2,
        explanation:
          "La linéarité mathématique de Schnorr autorise l'agrégation : plusieurs signatures n'en forment plus qu'une, indistinguable d'une signature unique.",
      },
      {
        type: "TRUE_FALSE",
        question: "Une dépense par key path est indiscernable d'un paiement simple sur la chaîne.",
        options: [],
        correctBool: true,
        explanation:
          "Le key path ne révèle que la clé tweakée : pour un observateur, la transaction ressemble exactement à un paiement Taproot ordinaire.",
      },
      {
        type: "MCQ",
        question: "Que deviennent les branches non exécutées d'un contrat MAST ?",
        options: [
          "Elles sont publiées en clair",
          "Elles sont détruites définitivement",
          "Elles doublent les frais du contrat",
          "Elles restent cachées, prouvées seulement si elles sont utilisées",
        ],
        correctIndex: 3,
        explanation:
          "Le MAST ne révèle que la branche exécutée, accompagnée de sa preuve de Merkle ; les autres conditions restent invisibles.",
      },
    ],
  },
  {
    code: "halving-challenge",
    track: "SPECIAL",
    order: 11,
    title: "Défi Halving",
    subtitle: "La rareté gravée dans le code",
    description:
      "Défi chrono : mine un bloc avant la fin du compte à rebours et assimile l'histoire des halvings.",
    intro:
      "Tous les 210 000 blocs, la récompense des mineurs est divisée par deux. Ce rendez-vous, le halving, structure toute l'économie de Bitcoin : émission décroissante, rareté programmée, choc d'offre parfaitement prévisible.\n\nDans cette quête finale, tu traverseras l'histoire des halvings depuis 2012 et tu comprendras pourquoi les 21 millions sont gravés dans le code. Puis tu affronteras le chrono dans un défi de minage accéléré. Bonne chance, mineur.",
    requiredLevel: 6,
    xpReward: 120,
    satsReward: 5000,
    missionType: "mine_nonce",
    missionConfig: { difficulty: "00", maxNonce: 60000 },
    missionBrief:
      "Défi chrono : trouve dans BitLab un nonce dont le hash commence par « 00 » avant la fin du compte à rebours, puis valide-le pour miner ton bloc.",
    missionHint:
      "La difficulté est douce mais la montre impitiable : lance la recherche immédiatement et garde un rythme régulier.",
    theorySections: [
      {
        title: "L'histoire des halvings",
        body: "Premier halving en novembre 2012 : la récompense passe de 50 à 25 BTC. Suivent 12,5 BTC en juillet 2016, 6,25 BTC en mai 2020, puis 3,125 BTC en avril 2024.\n\nChaque événement divise par deux l'émission de nouveaux bitcoins. Le prochain est attendu vers 2028 pour 1,5625 BTC, et la subvention s'éteindra définitivement vers l'année 2140. Aucun rendez-vous comparable n'existe dans l'histoire monétaire : la politique monétaire est écrite d'avance, à la seconde près, dans le code.",
        keypoints: [
          "2012 : 50 vers 25 BTC ; 2016 : 12,5 ; 2020 : 6,25 ; 2024 : 3,125.",
          "Le halving survient tous les 210 000 blocs, environ tous les 4 ans.",
          "Le prochain halving est attendu vers 2028.",
          "La subvention de bloc atteindra zéro vers l'année 2140.",
        ],
      },
      {
        title: "21 millions, ni plus ni moins",
        body: "L'offre de Bitcoin est plafonnée à 21 millions d'unités par le code. La modifier exigerait un consensus mondial, contraire à l'intérêt de tous les détenteurs : la règle tient donc d'elle-même, protégée par l'intérêt collectif.\n\nCette rareté est dite programmatique : elle ne dépend ni d'une banque centrale ni d'une décision politique, mais d'une limite vérifiable par chacun. Plus de 19,8 millions de BTC ont déjà été émis, et les bitcoins perdus rendent l'offre réelle encore plus resserrée.",
        keypoints: [
          "L'offre totale est limitée à 21 millions de BTC.",
          "Modifier cette règle exigerait un consensus quasi impossible à réunir.",
          "La rareté se vérifie soi-même, elle n'est promise par personne.",
          "Les bitcoins définitivement perdus resserrent encore l'offre effective.",
        ],
      },
      {
        title: "Stock-to-flow et réalités",
        body: "Le stock-to-flow compare le stock existant à l'émission annuelle. Après chaque halving, le ratio double, ce qui a alimenté de célèbres modèles prédictifs du cours.\n\nMais ce modèle ignore la demande : un ratio élevé ne garantit rien si l'adoption stagne. Il reste un cadre utile pour penser la rareté, pas une boule de cristal. Les mineurs, eux, subissent le choc en direct : leurs revenus en subvention chutent de moitié du jour au lendemain.",
        keypoints: [
          "Stock-to-flow = stock existant divisé par l'émission annuelle.",
          "Chaque halving double mécaniquement ce ratio.",
          "Le modèle ignore la demande et a montré ses limites.",
          "Après un halving, la rémunération des mineurs en BTC est divisée par deux.",
        ],
      },
    ],
    quiz: [
      {
        type: "MCQ",
        question: "Quelle était la récompense de bloc entre juillet 2016 et mai 2020 ?",
        options: ["50 BTC", "25 BTC", "12,5 BTC", "6,25 BTC"],
        correctIndex: 2,
        explanation:
          "Le halving de juillet 2016 a fixé la récompense à 12,5 BTC, jusqu'au passage à 6,25 BTC en mai 2020.",
      },
      {
        type: "MCQ",
        question: "Vers quelle année le dernier bitcoin sera-t-il miné ?",
        options: ["2040", "2240", "2028", "2140"],
        correctIndex: 3,
        explanation:
          "Avec des halvings tous les quatre ans, l'émission devient infime et s'achève autour de l'année 2140.",
      },
      {
        type: "TRUE_FALSE",
        question: "Le stock-to-flow garantit mécaniquement la hausse du cours après chaque halving.",
        options: [],
        correctBool: false,
        explanation:
          "Le ratio décrit l'offre mais ignore totalement la demande : son pouvoir prédictif a été sérieusement remis en cause après 2021.",
      },
      {
        type: "MCQ",
        question: "Quel effet un halving produit-il immédiatement sur les mineurs ?",
        options: [
          "Leurs revenus en subvention sont divisés par deux",
          "Leur électricité coûte deux fois moins cher",
          "La difficulté tombe à zéro pendant un jour",
          "Ils perçoivent des frais doublés",
        ],
        correctIndex: 0,
        explanation:
          "La subvention de bloc est divisée par deux instantanément ; la difficulté, elle, ne s'ajuste que tous les 2 016 blocs.",
      },
    ],
  },
];

export const botUsersSeed: { pseudo: string; xp: number; sats: number }[] = [
  { pseudo: "n0de_runner", xp: 1440, sats: 18400 },
  { pseudo: "satHunter", xp: 1215, sats: 15400 },
  { pseudo: "mempool_queen", xp: 980, sats: 12300 },
  { pseudo: "hexa_satoshi", xp: 760, sats: 9500 },
  { pseudo: "utxoBaron", xp: 545, sats: 6800 },
  { pseudo: "blockHenri", xp: 385, sats: 4600 },
  { pseudo: "LunaSats", xp: 215, sats: 2600 },
  { pseudo: "petit_miner", xp: 85, sats: 900 },
];
