# i18n contribution — Wolof

BitQuest supports three languages: **French** (primary target
audience, default locale), **English** and **Wolof**. The Wolof file
`src/i18n/messages/wo.json` is currently a **skeleton**: only
about fifteen anchor keys (navigation, common buttons, auth title)
are translated. The other keys **automatically fall back to French**
via the `translate()` function until they are filled in.

This document explains how to contribute translations.

## Who can contribute

Ideally a **native Wolof speaker** with:
- strong written proficiency (CLAD/CNC standardized orthography),
- some notions of tech culture (Bitcoin / Lightning useful but not
  required — some terms can stay in French if the Wolof equivalent
  is not natural).

You don't need to be a developer: the file is a simple JSON, editable
with any text editor.

## Proposed workflow

1. **Fork + clone** the repo.
2. Open `src/i18n/messages/wo.json`. The file already contains part
   of the keys — feel free to refine these translations or to fill
   them out.
3. To add/refine a translation, check the equivalent key in
   `src/i18n/messages/fr.json`: it serves as the reference. The EN
   version (`en.json`) can also help disambiguate a term.
4. **Interpolations**: keys that contain `{var}` (e.g.
   `"{count} days"`) must keep exactly the same variable name inside
   the braces, but the order and the rest of the text can be adapted
   to Wolof.
5. **No need to translate everything at once**: each added key
   instantly replaces the French fallback. You can open a PR with 20
   translated keys, then more later.
6. Test locally if you can:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   # open http://localhost:3000 and click the language button
   # in the top right to switch to WO
   ```
7. Open a PR with the title `i18n(wo): …` and a summary of the
   affected keys.

## Writing conventions

- **Orthography**: follow Senegal's official standard (decree
  2005-980). Examples: `jàng` (to learn), `jëfandikukat`
  (user), `mandat` (mission/quest), `tërëlu` (settings).
- **Tech neologisms**: keep the English/French term if local usage
  is already crystallized (e.g. "Bitcoin", "Lightning", "wallet").
  For domain concepts (xp, sats, quests…), favor explicit borrowing
  (e.g. `XP yi`, `sats yi`).
- **Diacritics**: keep the signs required by the Wolof standard
  (`ñ`, `ë`, `à`, `ó`…). The repo is UTF-8.
- **Tone**: generalized informal address (as in French), to match
  BitQuest's "solo adventurer" approach.

## How the fallback works

```ts
// src/i18n/dictionaries.ts
export function translate(locale: Locale, key: string): string {
  const d = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const localized = d[key];
  if (localized && localized.length > 0) return localized;
  return DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
}
```

In other words:
1. Look up in `wo.json`.
2. If absent (or empty string), look up in `fr.json`.
3. Otherwise, return the raw key (visible so the gap is flagged).

Result: you can push a partial `wo.json` without breaking the
application.

## Already-translated keys (reference)

The initial skeleton covers:

| Key | Wolof translation |
|---|---|
| `nav.dashboard` | Tablo |
| `nav.quests` | Mandat yi |
| `nav.profile` | Sa profil |
| `nav.wallet` | Wallet |
| `nav.leaderboard` | Dëkk-dëkkële |
| `nav.academy` | Akademi |
| `nav.logout` | Génn |
| `auth.title` | Dalal ak jàmm ci BitQuest |
| `auth.subtitle` | Jàngal Bitcoin, jëfandikoo BitLab, jot satoshis ciy jàngam. |
| `common.cancel` | Bañ |
| `common.save` | Denc |
| `common.delete` | Fàww |
| `common.loading` | Mu ngi lekk… |
| `common.error` | Njuumte |
| `common.retry` | Jéemaat |
| `common.back` | Dellu |

These translations were drafted carefully; if you're a native speaker
and notice an awkward phrasing, feel free to revise them in your PR.

## Contact

Open an issue with the label `i18n/wo` or mention `@alhDiallo2018`
in your PR to discuss a translation nuance.

**Jërëjëf!** 🙏
