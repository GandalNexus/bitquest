/**
 * Catalogue initial de l'Académie BitQuest.
 *
 * Structure : Course → Chapter → Lesson (Markdown pur).
 * Les slugs doivent rester stables (URLs publiques) ;
 * ajouter du contenu via de nouvelles entrées, sans renommer les existantes.
 */

export interface AcademyLessonSeed {
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  content: string;
}

export interface AcademyChapterSeed {
  slug: string;
  title: string;
  summary: string;
  lessons: AcademyLessonSeed[];
}

export interface AcademyCourseSeed {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverIcon: string;
  chapters: AcademyChapterSeed[];
}

/* ============================================================
 * Cours 1 — Fondamentaux Bitcoin
 * ============================================================ */

const fondamentauxBitcoin: AcademyCourseSeed = {
  slug: "fondamentaux-bitcoin",
  title: "Fondamentaux Bitcoin",
  subtitle: "Comprendre Bitcoin de l'intérieur : histoire, propriété et consensus.",
  description:
    "Un parcours structuré pour aborder Bitcoin par ses idées essentielles. Tu découvres pourquoi Bitcoin a été créé, comment il résout le problème de la double dépense, et comment la propriété numérique devient possible sans intermédiaire de confiance.",
  coverIcon: "BookOpen",
  chapters: [
    {
      slug: "origines-et-vision",
      title: "Origines et vision",
      summary: "D'où vient Bitcoin et quel problème il résout.",
      lessons: [
        {
          slug: "pourquoi-bitcoin",
          title: "Pourquoi Bitcoin ?",
          summary: "Les motivations derrière la création de Bitcoin.",
          estimatedMinutes: 6,
          content: `## Un contexte économique particulier

Bitcoin apparaît en **2008**, en pleine crise financière mondiale. Les banques centrales interviennent massivement, les sauvetages se multiplient, et une partie du public commence à chercher une alternative à un système monétaire qu'elle perçoit comme fragile.

C'est dans ce contexte que, le **31 octobre 2008**, un auteur anonyme nommé **Satoshi Nakamoto** publie un document de neuf pages intitulé « *Bitcoin: A Peer-to-Peer Electronic Cash System* ».

## Trois idées fondatrices

Bitcoin propose trois ruptures :

1. **Un paiement de pair à pair** : pas d'intermédiaire, pas d'autorité centrale.
2. **Un registre public vérifiable** : toutes les transactions sont ouvertes et auditables.
3. **Une émission prévisible** : 21 millions d'unités au maximum, selon un calendrier public.

## Ce que Bitcoin n'est pas

Pour comprendre Bitcoin, il est utile d'écarter quelques idées reçues :

- Ce n'est **pas une entreprise** : il n'y a pas de PDG, ni de siège social.
- Ce n'est **pas un paiement gratuit** : chaque transaction paie une petite commission aux mineurs.
- Ce n'est **pas anonyme par défaut** : toutes les transactions sont publiques ; seule l'identité réelle derrière une adresse peut rester privée, avec effort.

## À retenir

Bitcoin est une **expérience monétaire ouverte** : un code source libre, un protocole, et un réseau de machines qui exécutent les mêmes règles. Sa valeur repose sur l'adhésion volontaire d'utilisateurs, de développeurs et de mineurs à ces règles communes.
`,
        },
        {
          slug: "le-probleme-de-la-double-depense",
          title: "Le problème de la double dépense",
          summary: "Pourquoi la monnaie numérique était si difficile à inventer.",
          estimatedMinutes: 5,
          content: `## Un fichier, ce n'est pas de la monnaie

Un fichier peut être **copié à l'infini**. Si une pièce de monnaie était simplement une image ou un fichier, rien n'empêcherait de la dupliquer et de la dépenser plusieurs fois.

Ce problème porte un nom : la **double dépense** (*double spending*). C'est le principal obstacle que les monnaies numériques avant Bitcoin n'ont jamais réussi à résoudre sans un **tiers de confiance** (banque, serveur central, etc.).

## La solution classique : un intermédiaire

Le modèle traditionnel repose sur une **autorité centrale** qui tient un registre :

- Tu veux payer Alice ? La banque débite ton compte, crédite le sien.
- Elle garantit qu'une somme ne peut être dépensée deux fois.

Mais cela crée une **dépendance** : l'autorité peut censurer, se tromper, être piratée, ou disparaître.

## La solution de Bitcoin : un registre partagé

Bitcoin résout la double dépense sans tiers de confiance en combinant :

- un **registre public** (la blockchain) que **tous** les participants peuvent consulter,
- un mécanisme de **consensus** qui définit, parmi plusieurs versions possibles, laquelle est la vraie,
- un **coût réel** (l'énergie du minage) pour rendre la falsification trop chère à tenter.

Résultat : chaque transaction, une fois confirmée, est **irréversible** et **universellement vérifiable** — sans qu'aucun acteur unique ne tienne le registre.

## À retenir

Bitcoin ne supprime pas le registre : il le **partage**. Le problème de la double dépense devient résoluble parce que la bonne version du registre est désormais celle que **personne ne contrôle**, mais que **tout le monde peut vérifier**.
`,
        },
        {
          slug: "qui-est-satoshi-nakamoto",
          title: "Qui est Satoshi Nakamoto ?",
          summary: "Le pseudonyme derrière Bitcoin, et pourquoi son anonymat est une force.",
          estimatedMinutes: 4,
          content: `## Un pseudonyme, pas une personne

**Satoshi Nakamoto** est le pseudonyme utilisé par la personne — ou le groupe — à l'origine de Bitcoin. Son identité réelle n'a jamais été confirmée.

Les faits que l'on connaît :

- Publication du **white paper** le 31 octobre 2008.
- Lancement du réseau le **3 janvier 2009** avec le minage du **bloc 0**, dit *bloc Genesis*.
- Participation active sur les forums entre 2009 et mi-2010.
- Dernière communication publique en **avril 2011**, puis silence total.

## Un départ volontaire

Satoshi a progressivement passé la main au développeur **Gavin Andresen**, puis s'est retiré complètement. Les milliers de bitcoins minés dans les premiers mois (estimés à ~1 million) **n'ont jamais bougé**.

## Pourquoi son anonymat compte

Si Satoshi avait un nom, un visage et une adresse :

- Il aurait pu être **ciblé** (par des États, des entreprises, des individus).
- Il pourrait être **influencé** pour modifier le protocole.
- Son opinion personnelle prendrait une **autorité** que Bitcoin ne doit à personne.

En disparaissant, Satoshi a laissé Bitcoin **sans chef**. C'est désormais le code et le consensus des utilisateurs qui font loi — pas une parole humaine.

## À retenir

L'anonymat de Satoshi n'est pas un mystère à percer : c'est une **caractéristique de design**. Bitcoin est conçu pour fonctionner sans aucune figure centrale, y compris celle de son propre créateur.
`,
        },
      ],
    },
    {
      slug: "propriete-numerique",
      title: "La propriété numérique",
      summary: "Clés, adresses et signature : comment posséder sans intermédiaire.",
      lessons: [
        {
          slug: "cle-privee-et-cle-publique",
          title: "Clé privée et clé publique",
          summary: "La paire de clés qui est le cœur de la propriété Bitcoin.",
          estimatedMinutes: 6,
          content: `## Posséder, c'est pouvoir prouver

En Bitcoin, **posséder des bitcoins**, c'est connaître un secret : la **clé privée** associée à une adresse. Pas de compte, pas de mot de passe serveur, pas de banque — juste **un nombre** très grand, choisi au hasard.

## Une paire mathématique

Depuis une clé privée, on dérive une **clé publique** par une fonction à sens unique (cryptographie sur courbe elliptique, *secp256k1*).

- **Clé privée** : nombre de 256 bits — *reste secret, toujours*.
- **Clé publique** : nombre dérivé — peut être partagé.
- **Adresse Bitcoin** : empreinte (hash) de la clé publique — c'est ce qu'on affiche pour recevoir des fonds.

\`\`\`
Clé privée (secrète) → Clé publique → Adresse (publique)
\`\`\`

Il est **facile** de passer de la clé privée à l'adresse. Il est **statistiquement impossible** de faire le chemin inverse.

## Signer une transaction

Pour dépenser, l'utilisateur **signe** la transaction avec sa clé privée. Le réseau vérifie la signature avec la clé publique — sans jamais voir la clé privée.

C'est la première fois dans l'histoire qu'on peut **prouver qu'on possède quelque chose** sans montrer le secret qui le prouve.

## Garder ou perdre ses clés

| Scénario | Conséquence |
|---|---|
| Tu gardes ta clé privée | Tu contrôles tes bitcoins |
| Tu la perds | Les bitcoins sont **inaccessibles** à jamais |
| Quelqu'un la vole | Il peut dépenser tes bitcoins |

Aucun support client, aucune banque ne peut récupérer une clé perdue. **La responsabilité est entièrement individuelle.**

## À retenir

En Bitcoin, la propriété repose sur **la cryptographie**, pas sur un registre tenu par un tiers. Ta clé privée, c'est **toi**. Tout le reste en découle.
`,
        },
        {
          slug: "adresses-et-transactions",
          title: "Adresses et transactions",
          summary: "De la clé à l'adresse, et de l'adresse à la transaction confirmée.",
          estimatedMinutes: 5,
          content: `## Qu'est-ce qu'une adresse ?

Une **adresse Bitcoin** est une chaîne de caractères dérivée d'une clé publique. Elle permet à n'importe qui de t'envoyer des bitcoins sans rien savoir de toi.

Exemples de formats :

- **Legacy** (ancien) : commence par \`1\` — \`1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa\`.
- **SegWit v0** (*bech32*) : commence par \`bc1q\` — plus efficace, transactions moins chères.
- **Taproot** (*bech32m*) : commence par \`bc1p\` — meilleur anonymat, scripts plus flexibles.

Peu importe le format : derrière une adresse, il y a **toujours** une clé privée nécessaire pour dépenser ce qui s'y trouve.

## Anatomie d'une transaction

Une transaction Bitcoin comprend trois éléments essentiels :

1. **Entrées (inputs)** : d'où viennent les bitcoins ? Référence à des sorties précédentes non dépensées.
2. **Sorties (outputs)** : où vont-ils ? Une ou plusieurs adresses.
3. **Signatures** : preuves cryptographiques que l'expéditeur a le droit de dépenser les entrées.

> Chaque entrée consommée est une sortie d'une transaction antérieure. C'est le modèle **UTXO** (*Unspent Transaction Output*).

## Du clic à la confirmation

1. Tu composes une transaction dans ton wallet (destinataire, montant, frais).
2. Tu la **signes** avec ta clé privée.
3. Le wallet la **diffuse** sur le réseau pair-à-pair.
4. Des nœuds la vérifient et la relaient aux autres.
5. Un **mineur** finit par l'inclure dans un **bloc**.
6. Quand ce bloc est inséré dans la blockchain, la transaction est **confirmée**.

## Combien de confirmations ?

- **1 confirmation** : raisonnable pour les petits paiements.
- **6 confirmations** : convention historique pour les transactions importantes (environ 1 heure d'attente).

Chaque nouveau bloc rend l'annulation d'une transaction **exponentiellement plus coûteuse**.

## À retenir

Une adresse reçoit, une signature dépense, un bloc confirme. Bitcoin, c'est une longue chaîne de **transactions signées et vérifiées**, et rien d'autre.
`,
        },
      ],
    },
    {
      slug: "blockchain-et-consensus",
      title: "Blockchain et consensus",
      summary: "Blocs, minage, et la règle de la chaîne la plus longue.",
      lessons: [
        {
          slug: "qu-est-ce-qu-un-bloc",
          title: "Qu'est-ce qu'un bloc ?",
          summary: "La brique élémentaire de la blockchain Bitcoin.",
          estimatedMinutes: 5,
          content: `## Un bloc, un chapitre d'histoire

Un **bloc** est un conteneur qui regroupe un ensemble de transactions récemment validées par le réseau. Toutes les **~10 minutes**, un nouveau bloc est ajouté à la chaîne.

Chaque bloc contient :

- Un **en-tête** (*block header*) : métadonnées, hash du bloc précédent, horodatage, cible de difficulté, *nonce*.
- Une **liste de transactions** : jusqu'à environ 2 000 à 4 000 par bloc, selon leur taille.

## Le chaînage par hash

Chaque en-tête inclut le **hash** du bloc précédent. Ce hash est une empreinte unique calculée à partir du contenu du bloc.

\`\`\`
Bloc N-1 ──hash──▶ Bloc N ──hash──▶ Bloc N+1 ──hash──▶ Bloc N+2
\`\`\`

Conséquence : si on modifie **une seule transaction** dans un vieux bloc, son hash change, donc **tous les blocs suivants deviennent invalides**. C'est ce qui donne son nom à la **blockchain** : une chaîne d'empreintes.

## Un bloc, un consensus

Un bloc n'a de valeur que s'il est **accepté par la majorité du réseau**. Pour cela, il doit :

1. Contenir **uniquement des transactions valides** (signatures correctes, pas de double dépense).
2. Respecter la **cible de difficulté** actuelle (preuve de travail suffisante — voir leçon suivante).
3. Avoir une **récompense de bloc** (la *coinbase*) qui respecte les règles d'émission.

## Le bloc Genesis

Le **bloc 0**, miné par Satoshi le **3 janvier 2009**, contient dans ses données un message codé en dur :

> *"The Times 03/Jan/2009 Chancellor on brink of second bailout for banks."*

C'est à la fois une datation vérifiable et un **manifeste** : Bitcoin est né en réaction à un système que son créateur voyait comme inextricablement fragile.

## À retenir

Un bloc, c'est une page du **grand livre comptable public** de Bitcoin. Les pages sont scellées entre elles par un hash, numérotées, et visibles par tous. Supprimer une page, c'est casser toutes les suivantes.
`,
        },
        {
          slug: "le-minage-et-la-preuve-de-travail",
          title: "Le minage et la preuve de travail",
          summary: "Comment un nouveau bloc est accepté par le réseau.",
          estimatedMinutes: 7,
          content: `## Un concours ouvert, un gagnant à chaque tour

Toutes les ~10 minutes, un nouveau bloc rejoint la chaîne. Mais **qui décide** du contenu de ce bloc ?

Réponse : **n'importe qui peut essayer**. Les candidats s'appellent des **mineurs**. Celui qui trouve en premier une solution à un puzzle cryptographique propose le bloc suivant — et empoche la récompense.

## Le puzzle : la preuve de travail

Le puzzle est simple à décrire, coûteux à résoudre :

> Trouver un nombre (*nonce*) tel que le **hash** de l'en-tête du bloc soit **inférieur à une certaine cible**.

Il n'existe **aucun raccourci** mathématique. Il faut essayer, essayer encore, des trillions de fois. C'est pour cela qu'on parle de **preuve de travail** (*proof of work*) : la seule façon de trouver un bloc est de **dépenser de l'énergie**.

## La difficulté s'ajuste

Toutes les **2 016 blocs** (~2 semaines), le réseau mesure le temps réel entre les blocs et ajuste la difficulté :

- Blocs trop rapides → difficulté **augmente**.
- Blocs trop lents → difficulté **diminue**.

Le réseau vise toujours **10 minutes** en moyenne par bloc. C'est l'un des mécanismes les plus importants et les plus stables de Bitcoin.

## La récompense du mineur

Quand un mineur publie un bloc valide, il reçoit :

- La **subvention de bloc** (la *coinbase*) : actuellement **3,125 BTC** par bloc (après le halving de 2024).
- La **somme des frais** de toutes les transactions incluses dans le bloc.

Cette récompense est la seule source de nouveaux bitcoins : **aucun bitcoin ne peut apparaître autrement**.

## Pourquoi ça fonctionne

Un attaquant qui voudrait réécrire l'histoire devrait :

1. Rematerialiser tout le travail déjà accompli,
2. Dépasser la vitesse du réseau honnête,
3. Et absorber un coût énergétique et matériel colossal.

C'est **possible en théorie** (attaque 51 %), **mais irrationnel en pratique** : l'attaquant gagnerait plus à miner honnêtement qu'à saper le réseau qu'il attaque.

## À retenir

La preuve de travail transforme de l'**énergie physique** en **certitude historique**. Chaque nouveau bloc rend la chaîne plus difficile à défaire. C'est le prix que Bitcoin paie pour exister sans autorité centrale.
`,
        },
        {
          slug: "l-emission-et-les-halvings",
          title: "L'émission et les halvings",
          summary: "Comment les 21 millions de bitcoins sont distribués.",
          estimatedMinutes: 5,
          content: `## Un calendrier d'émission fixe

Bitcoin a une **politique monétaire inscrite dans le code**. Personne ne décide d'imprimer plus ou moins : tout est prédéfini.

Les règles essentielles :

- **Émission totale** : 21 millions de BTC, jamais plus.
- **Vitesse d'émission** : une récompense par bloc, toutes les ~10 minutes.
- **Division** : tous les **210 000 blocs** (≈ 4 ans), la récompense est **divisée par deux**. C'est le **halving**.

## Les récompenses successives

| Période | Blocs | Récompense | Halving |
|---|---|---|---|
| 2009–2012 | 0 – 209 999 | 50 BTC | — |
| 2012–2016 | 210 000 – 419 999 | 25 BTC | n°1 |
| 2016–2020 | 420 000 – 629 999 | 12,5 BTC | n°2 |
| 2020–2024 | 630 000 – 839 999 | 6,25 BTC | n°3 |
| 2024–2028 | 840 000 – 1 049 999 | 3,125 BTC | n°4 |
| … | … | … | … |

Vers **2140**, la récompense atteindra zéro. À partir de là, les mineurs ne seront payés que par les **frais de transaction**.

## Pourquoi un halving ?

Deux raisons principales :

1. **Rareté** : une émission qui ralentit crée une rareté croissante (par opposition aux monnaies fiat dont l'offre peut s'étendre librement).
2. **Prévisibilité** : chaque utilisateur peut calculer **à l'avance** combien de bitcoins existeront dans 10, 20 ou 100 ans. C'est une transparence inédite en matière monétaire.

## Un impact sur l'écosystème

Chaque halving divise par deux le flux de nouveaux bitcoins. Historiquement, les halvings ont marqué des cycles importants : adaptation des mineurs, pression sur les coûts, dynamiques de prix. Rien n'est garanti pour l'avenir, mais la **règle** elle-même, elle, est garantie par le code.

## À retenir

Bitcoin n'a pas de banque centrale. Son offre est **plafonnée**, son calendrier est **public**, et chacun peut le vérifier. C'est l'une des différences les plus radicales entre Bitcoin et toutes les monnaies qui l'ont précédé.
`,
        },
      ],
    },
  ],
};

export const academyCoursesSeed: AcademyCourseSeed[] = [fondamentauxBitcoin];
