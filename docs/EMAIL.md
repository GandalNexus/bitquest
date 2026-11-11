# Envoi d'emails (mailer BitQuest)

Phase 1 (auth) a posé le modèle `verificationToken` + l'endpoint
`POST /api/auth/verification/send` ; cette couche complète la boucle en
câblant un vrai envoi d'email via un provider externe.

## Providers supportés

| `MAIL_PROVIDER` | Comportement | Recommandation |
|---|---|---|
| `none` (défaut) | Log l'email en console, retourne `ok=true`. Pas d'envoi réseau. | Dev local |
| `resend` | Envoi via l'API REST [Resend](https://resend.com/) (`https://api.resend.com/emails`). | Prod |

L'ajout de SMTP générique (nodemailer) ou SendGrid se fait en ajoutant
un cas au dispatch dans `src/lib/mail/mailer.ts:sendMail`.

## Config

```bash
# Prod avec Resend
MAIL_PROVIDER=resend
MAIL_FROM="BitQuest <noreply@ton-domaine-vérifié.com>"
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# Dev
# (ne rien configurer ; MAIL_PROVIDER=none par défaut)
```

**Attention à `MAIL_FROM`** : Resend exige que le domaine d'envoi soit
*vérifié* dans le dashboard (SPF + DKIM + DMARC). Sinon l'envoi
retourne 422 et le mailer loggera `domain not verified`.

## Génération d'une clé Resend

1. Créer un compte sur [resend.com](https://resend.com/).
2. Ajouter et vérifier un domaine (ou utiliser `onboarding@resend.dev`
   pour tester).
3. **API Keys → Create API Key** : choisir scope `Sending access` +
   permissions sur le domaine. Copier la valeur `re_xxx…` (visible une
   seule fois).

## Flux d'envoi

1. L'utilisateur s'enregistre via `POST /api/auth` action=register.
   → `sendVerificationEmail(email, pseudo, token)` est appelé en
   fire-and-forget (ne bloque pas la réponse).
2. L'utilisateur peut re-déclencher l'envoi via
   `POST /api/auth/verification/send` (rate-limit 3/min).
3. Le serveur appelle `sendMail(verificationEmailTemplate(...))` qui
   dispatche vers le provider.
4. En retour :
   - `provider === "resend"` + `res.ok === true` → `dispatched = true`
     côté handler, réponse `{ ok: true, dispatched: true }` (pas de
     `devUrl` exposé).
   - Provider none ou échec → `dispatched = false`. En dev,
     `devUrl` est renvoyé pour que l'apprenant clique le lien sans
     boîte mail.

## Template

`src/lib/mail/templates.ts:verificationEmailTemplate` retourne
`{ to, subject, html, text }` :

- **Subject** : « Vérifie ton adresse — BitQuest »
- **HTML** : cartes dark-mode avec CTA button (inline styles,
  compatibilité Gmail/Outlook)
- **Text** : version plain avec URL seule, pour les clients email
  sans HTML

Le pseudo et l'URL sont échappés via `escapeHtml` pour prévenir une
injection HTML dans le nom d'utilisateur.

## Tests

- `src/lib/mail/mailer.test.ts` — 11 tests : dispatch provider, Bearer,
  fallback none si API key manquante, erreur Resend 422, fetch rejected
- `src/lib/mail/templates.test.ts` — 4 tests : pseudo/url inclus,
  échappement HTML (XSS prévention sur pseudo + URL)

## Logs

Chaque envoi loggue via `logger("mailer")` :

- `provider=none` : `mail: provider=none, printing to logs` puis
  `mail body (text version)` avec le texte complet.
- `provider=resend, ok` : `mail sent via resend` + `resendId`.
- `provider=resend, ko` : `resend send failed` avec status et detail.

`logger("email-verification")` complète côté caller avec
`verification email dispatched` ou `verification email not dispatched`.

## Quand upgrade (SMTP / SendGrid)

Ajouter un cas dans `sendMail` :

```ts
if (provider === "smtp") return await sendViaSmtp(message);
```

Implémenter `sendViaSmtp` avec `nodemailer` (à ajouter aux deps). La
config SMTP peut passer par une URL unique :

```
SMTP_URL=smtps://user:pass@smtp.example.com:465
```

Les tests existants vérifient que l'enum `MAIL_PROVIDER` tolère les
providers inconnus en retombant sur `none` — aucun risque de
régression.
