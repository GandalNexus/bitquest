# Email sending (BitQuest mailer)

Phase 1 (auth) laid down the `verificationToken` model + the
`POST /api/auth/verification/send` endpoint; this layer closes the
loop by wiring up real email sending through an external provider.

## Supported providers

| `MAIL_PROVIDER` | Behavior | Recommendation |
|---|---|---|
| `none` (default) | Logs the email to the console, returns `ok=true`. No network sending. | Local dev |
| `resend` | Sending via the [Resend](https://resend.com/) REST API (`https://api.resend.com/emails`). | Prod |

Adding a generic SMTP (nodemailer) or SendGrid is done by adding a
case to the dispatch in `src/lib/mail/mailer.ts:sendMail`.

## Config

```bash
# Prod with Resend
MAIL_PROVIDER=resend
MAIL_FROM="BitQuest <noreply@your-verified-domain.com>"
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# Dev
# (nothing to configure; MAIL_PROVIDER=none by default)
```

**Watch out for `MAIL_FROM`**: Resend requires the sending domain to
be *verified* in the dashboard (SPF + DKIM + DMARC). Otherwise sending
returns 422 and the mailer will log `domain not verified`.

## Generating a Resend key

1. Create an account on [resend.com](https://resend.com/).
2. Add and verify a domain (or use `onboarding@resend.dev` to test).
3. **API Keys → Create API Key**: choose scope `Sending access` +
   permissions on the domain. Copy the `re_xxx…` value (shown only
   once).

## Sending flow

1. The user registers via `POST /api/auth` action=register.
   → `sendVerificationEmail(email, pseudo, token)` is called
   fire-and-forget (does not block the response).
2. The user can re-trigger sending via
   `POST /api/auth/verification/send` (rate-limit 3/min).
3. The server calls `sendMail(verificationEmailTemplate(...))` which
   dispatches to the provider.
4. In return:
   - `provider === "resend"` + `res.ok === true` → `dispatched = true`
     on the handler side, response `{ ok: true, dispatched: true }`
     (no `devUrl` exposed).
   - Provider none or failure → `dispatched = false`. In dev,
     `devUrl` is returned so the learner can click the link without
     an inbox.

## Template

`src/lib/mail/templates.ts:verificationEmailTemplate` returns
`{ to, subject, html, text }`:

- **Subject**: "Verify your address — BitQuest"
- **HTML**: dark-mode cards with CTA button (inline styles,
  Gmail/Outlook compatible)
- **Text**: plain version with URL only, for email clients without
  HTML

The pseudo and URL are escaped via `escapeHtml` to prevent HTML
injection in the user name.

## Tests

- `src/lib/mail/mailer.test.ts` — 11 tests: provider dispatch, Bearer,
  fallback to none if API key missing, Resend 422 error, fetch rejected
- `src/lib/mail/templates.test.ts` — 4 tests: pseudo/url included,
  HTML escaping (XSS prevention on pseudo + URL)

## Logs

Every send logs via `logger("mailer")`:

- `provider=none`: `mail: provider=none, printing to logs` then
  `mail body (text version)` with the full text.
- `provider=resend, ok`: `mail sent via resend` + `resendId`.
- `provider=resend, ko`: `resend send failed` with status and detail.

`logger("email-verification")` complements on the caller side with
`verification email dispatched` or `verification email not dispatched`.

## When to upgrade (SMTP / SendGrid)

Add a case in `sendMail`:

```ts
if (provider === "smtp") return await sendViaSmtp(message);
```

Implement `sendViaSmtp` with `nodemailer` (to be added to deps). SMTP
config can be passed via a single URL:

```
SMTP_URL=smtps://user:pass@smtp.example.com:465
```

The existing tests verify that the `MAIL_PROVIDER` enum tolerates
unknown providers by falling back to `none` — no regression risk.
