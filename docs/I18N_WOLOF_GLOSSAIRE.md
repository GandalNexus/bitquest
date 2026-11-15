# Glossaire Wolof — BitQuest / GandalNexus

> Référence terminologique pour les contributeurs qui éditent
> `src/i18n/messages/wo.json`. LOT 73.
>
> Objectif : harmoniser le vocabulaire technique Bitcoin/Lightning
> en Wolof et guider une relecture future par un locuteur natif.

## 1. État actuel

- **Couverture mécanique** : 100% (412/412 clés FR couvertes, LOT 69).
- **Qualité littéraire** : fonctionnelle mais non validée par un
  locuteur natif. Les constructions respectent la grammaire mais le
  ton pédagogique peut parfois paraître littéral.

## 2. Vocabulaire technique Bitcoin en Wolof

Ces termes sont **conservés en français/anglais** dans wo.json parce
qu'ils sont des noms propres ou des termes techniques standards :

| Terme | Usage | Raison |
|---|---|---|
| Bitcoin | Protocole | Nom propre international. |
| Lightning | Réseau L2 | Idem. |
| BOLT11 | Format invoice | Spec standard. |
| UTXO | Sortie non dépensée | Acronyme. |
| nonce / hash | Mining | Acronyme + concept. |
| txid | ID de transaction | Acronyme. |
| xpub / tpub / mnemonic | HD wallet | Cf. BIP-32/39. |
| WIF | Format clé | Acronyme. |
| Schnorr / Taproot | Primitives | Noms propres. |
| multisig | N-of-M | Néologisme technique. |

## 3. Termes traduits — vocabulaire courant

| FR | WO | Note |
|---|---|---|
| mot de passe | baatu-kàggu | Litt. « mot de serrure ». Alternative : passwuurd. |
| connexion | duggu | Sens large (entrer). |
| déconnexion | génn | Sens large (sortir). |
| utilisateur | jëfandikukat / ki ngay jëfandikoo | Longueur variable. |
| compte | kont | Emprunt français intégré. |
| apprenant | jàngalekat | Litt. « celui qui apprend ». |
| récompense | mbugal | Sens strict. |
| preuve | preuve / dëgg | Emprunt FR courant ; `dëgg` = « vérité ». |
| erreur | njuumte | Sens strict. |
| réseau | rézo | Emprunt FR intégré. |
| classement | dëkk-dëkkële | Litt. « ranger-ranger ». |
| niveau | niwo | Emprunt FR. |

## 4. Suggestions pour un locuteur natif

Points à revoir prioritairement si une relecture est possible :

1. **Tonalité pédagogique** : certains textes longs (quest intro,
   theory sections) sont traduits littéralement. Un locuteur natif
   pourrait les rendre plus engageants.
2. **Diacritiques** : vérifier que tous les ò / ë / ñ sont corrects
   (notamment dans les noms propres où j'ai pu manquer des accents).
3. **Harmonisation** : certains termes alternent (ex: `yoon` /
   `piste` pour « track »). Décider d'une norme.
4. **Toasts et messages d'erreur** : vérifier le registre
   (impératif vs descriptif).
5. **Pluriels** : plusieurs clés ont une forme `_one` / `_many`
   mais la différence n'est pas toujours marquée en Wolof.

## 5. Process de contribution

- Les modifications à `wo.json` doivent préserver **100% des clés
  FR couvertes** (sinon le test
  `src/i18n/dictionaries.test.ts:dictionaries` casse).
- Lancer `npx vitest run` avant d'ouvrir une PR.
- Préférer des commits atomiques par bloc (ex: `i18n(wo): revue
  bloc player.*`).

## 6. État par bloc

| Bloc | Clés | Qualité | Notes |
|---|---:|---|---|
| nav, common | 12 | ✅ | Triviaux, OK. |
| auth | 10 | ✅ | Revus lors de LOT 14/15. |
| dashboard | 35 | ✅ | Hérité pré-audit. |
| account | 15 | ⚠️ | « baatu-kàggu » à valider. |
| profile | 34 | ⚠️ | Traduit LOT 62, non natif. |
| wallet | 19 | ⚠️ | LOT 63, cap.note pédagogique à peaufiner. |
| questMap, quests | 29 | ⚠️ | LOT 64. |
| player, intro, theory, quiz, mission | 56 | ⚠️ | LOT 65/66. |
| bitlabProof | 33 | ⚠️ | LOT 67, lexique crypto. |
| missionPanel, blockExplorer, keyForge, feeOpt | 45 | ⚠️ | LOT 68. |
| txBuilder, mineNonce, lnChannel, lnInvoice, multisig, taproot | 61 | ⚠️ | LOT 69, modules avancés. |
| rewards, dailyChallenge, leaderboard | 38 | ✅ | Rapprochements OK. |
| status, tracks, rarity | 12 | ✅ | Courts et précis. |
