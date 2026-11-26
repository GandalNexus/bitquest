# Wolof Glossary — BitQuest / GandalNexus

> Terminology reference for contributors editing
> `src/i18n/messages/wo.json`. BATCH 73.
>
> Goal: harmonize technical Bitcoin/Lightning vocabulary in Wolof
> and guide future review by a native speaker.

## 1. Current state

- **Mechanical coverage**: 100% (412/412 FR keys covered, BATCH 69).
- **Literary quality**: functional but not validated by a native
  speaker. The constructions respect the grammar but the pedagogical
  tone can sometimes feel literal.

## 2. Bitcoin technical vocabulary in Wolof

These terms are **kept in English/French** in wo.json because they
are proper nouns or standard technical terms:

| Term | Usage | Reason |
|---|---|---|
| Bitcoin | Protocol | International proper noun. |
| Lightning | L2 network | Same. |
| BOLT11 | Invoice format | Standard spec. |
| UTXO | Unspent output | Acronym. |
| nonce / hash | Mining | Acronym + concept. |
| txid | Transaction ID | Acronym. |
| xpub / tpub / mnemonic | HD wallet | Cf. BIP-32/39. |
| WIF | Key format | Acronym. |
| Schnorr / Taproot | Primitives | Proper nouns. |
| multisig | N-of-M | Technical neologism. |

## 3. Translated terms — common vocabulary

| English | WO | Note |
|---|---|---|
| password | baatu-kàggu | Lit. "lock word". Alternative: passwuurd. |
| login/connection | duggu | Broad sense (to enter). |
| logout/disconnection | génn | Broad sense (to exit). |
| user | jëfandikukat / ki ngay jëfandikoo | Variable length. |
| account | kont | Integrated French borrowing. |
| learner | jàngalekat | Lit. "the one who learns". |
| reward | mbugal | Strict sense. |
| proof | preuve / dëgg | Common FR borrowing; `dëgg` = "truth". |
| error | njuumte | Strict sense. |
| network | rézo | Integrated FR borrowing. |
| leaderboard | dëkk-dëkkële | Lit. "arrange-arrange". |
| level | niwo | FR borrowing. |

## 4. Suggestions for a native speaker

Priority review points if a review becomes possible:

1. **Pedagogical tone**: some long texts (quest intros, theory
   sections) are translated literally. A native speaker could make
   them more engaging.
2. **Diacritics**: check that all ò / ë / ñ are correct
   (especially in proper nouns where I may have missed accents).
3. **Harmonization**: some terms alternate (e.g. `yoon` /
   `piste` for "track"). Decide on a standard.
4. **Toasts and error messages**: check the register
   (imperative vs descriptive).
5. **Plurals**: several keys have an `_one` / `_many` form
   but the distinction is not always marked in Wolof.

## 5. Contribution process

- Changes to `wo.json` must preserve **100% of the FR keys
  covered** (otherwise the
  `src/i18n/dictionaries.test.ts:dictionaries` test breaks).
- Run `npx vitest run` before opening a PR.
- Prefer atomic commits per block (e.g. `i18n(wo): review
  player.* block`).

## 6. Status by block

| Block | Keys | Quality | Notes |
|---|---:|---|---|
| nav, common | 12 | ✅ | Trivial, OK. |
| auth | 10 | ✅ | Reviewed during BATCH 14/15. |
| dashboard | 35 | ✅ | Inherited pre-audit. |
| account | 15 | ⚠️ | "baatu-kàggu" to validate. |
| profile | 34 | ⚠️ | Translated BATCH 62, not native. |
| wallet | 19 | ⚠️ | BATCH 63, cap.note pedagogical to polish. |
| questMap, quests | 29 | ⚠️ | BATCH 64. |
| player, intro, theory, quiz, mission | 56 | ⚠️ | BATCH 65/66. |
| bitlabProof | 33 | ⚠️ | BATCH 67, crypto lexicon. |
| missionPanel, blockExplorer, keyForge, feeOpt | 45 | ⚠️ | BATCH 68. |
| txBuilder, mineNonce, lnChannel, lnInvoice, multisig, taproot | 61 | ⚠️ | BATCH 69, advanced modules. |
| rewards, dailyChallenge, leaderboard | 38 | ✅ | Matches OK. |
| status, tracks, rarity | 12 | ✅ | Short and accurate. |
