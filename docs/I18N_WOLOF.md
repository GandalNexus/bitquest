# Contribution i18n — Wolof

BitQuest supporte trois langues : **français** (public cible principal,
locale par défaut), **anglais** et **wolof**. Le fichier Wolof
`src/i18n/messages/wo.json` est actuellement un **squelette** : seules
une quinzaine de clés d'ancrage (navigation, boutons communs, titre
d'authentification) sont traduites. Les autres clés tombent
**automatiquement en fallback français** via la fonction
`translate()` tant qu'elles ne sont pas remplies.

Ce document explique comment contribuer aux traductions.

## Qui peut contribuer

Idéalement un **locuteur natif du wolof** avec :
- une bonne maîtrise écrite (orthographe standardisée CLAD/CNC),
- quelques notions de culture tech (Bitcoin / Lightning utile mais pas
  obligatoire — on peut toujours garder certains termes en français si
  l'équivalent wolof n'est pas naturel).

Pas besoin d'être développeur : le fichier est un JSON simple, éditable
avec n'importe quel éditeur texte.

## Workflow proposé

1. **Fork + clone** du dépôt.
2. Ouvre `src/i18n/messages/wo.json`. Le fichier contient déjà une
   partie des clés — libre à toi d'affiner ces traductions ou de les
   compléter.
3. Pour ajouter/affiner une traduction, consulte la clé équivalente
   dans `src/i18n/messages/fr.json` : elle sert de référence. La
   version EN (`en.json`) peut aussi aider à désambiguïser un terme.
4. **Interpolations** : les clés qui contiennent `{var}` (ex.
   `"{count} jours"`) doivent conserver exactement le même nom de
   variable à l'intérieur des accolades, mais l'ordre et le reste du
   texte peuvent être adaptés au wolof.
5. **Pas besoin de tout traduire d'un coup** : chaque clé ajoutée
   remplace instantanément le fallback français. Tu peux ouvrir une PR
   avec 20 clés traduites, puis d'autres par la suite.
6. Teste localement si tu peux :
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   # ouvre http://localhost:3000 et clique sur le bouton langue
   # en haut à droite pour passer sur WO
   ```
7. Ouvre une PR avec le titre `i18n(wo): …` et un résumé des clés
   touchées.

## Convention d'écriture

- **Orthographe** : suivre la norme officielle du Sénégal (décret
  2005-980). Exemples : `jàng` (apprendre), `jëfandikukat`
  (utilisateur), `mandat` (mission/quête), `tërëlu` (paramètres).
- **Néologismes tech** : garder le terme anglais/français si l'usage
  local est déjà cristallisé (ex. « Bitcoin », « Lightning », « wallet »).
  Pour les concepts métier (xp, sats, quêtes…), privilégier l'emprunt
  explicite (ex. `XP yi`, `sats yi`).
- **Diacritiques** : on garde les signes requis par la norme wolof
  (`ñ`, `ë`, `à`, `ó`…). Le dépôt est UTF-8.
- **Ton** : tutoiement généralisé (comme en français), pour coller à
  l'approche « aventurier solo » de BitQuest.

## Comment le fallback fonctionne

```ts
// src/i18n/dictionaries.ts
export function translate(locale: Locale, key: string): string {
  const d = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const localized = d[key];
  if (localized && localized.length > 0) return localized;
  return DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
}
```

Autrement dit :
1. Chercher dans `wo.json`.
2. Si absent (ou chaîne vide), chercher dans `fr.json`.
3. Sinon, retourner la clé brute (visible pour signaler le trou).

Résultat : tu peux pousser un `wo.json` partiel sans casser
l'application.

## Clés déjà traduites (référence)

Le squelette initial couvre :

| Clé | Traduction Wolof |
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

Ces traductions ont été rédigées avec prudence ; si tu es natif et
remarques une tournure maladroite, n'hésite pas à les reprendre dans ta
PR.

## Contact

Ouvre une issue avec le label `i18n/wo` ou mentionne `@alhDiallo2018`
dans ta PR pour échanger sur une nuance de traduction.

**Jërëjëf !** 🙏
