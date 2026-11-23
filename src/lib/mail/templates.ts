import type { MailMessage } from "./mailer";

/* ============================================================
 * Templates email BitQuest.
 *
 * Deux versions par mail : HTML (rendu riche) et text (fallback
 * client email texte uniquement ou lecture rapide). Les styles
 * HTML sont inlinés pour compatibilité maximale (Gmail, Outlook, …).
 * ============================================================ */

/**
 * Email de vérification d'adresse. `to` est renseigné par l'appelant
 * depuis User.email. `url` provient de buildVerificationUrl.
 */
export function verificationEmailTemplate(args: {
  to: string;
  pseudo: string;
  url: string;
}): MailMessage {
  const { to, pseudo, url } = args;
  const safePseudo = escapeHtml(pseudo);
  const safeUrl = escapeHtml(url);
  const subject = "Vérifie ton adresse — BitQuest";

  const html = `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#e6edf3;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#161b22;border:1px solid #30363d;border-radius:12px;">
      <tr>
        <td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#f0b000;">BitQuest</h1>
          <h2 style="margin:0 0 16px;font-size:18px;">Bonjour ${safePseudo},</h2>
          <p style="margin:0 0 16px;line-height:1.5;">
            Clique sur le bouton ci-dessous pour confirmer ton adresse email et débloquer la totalité
            de ton compte BitQuest.
          </p>
          <p style="margin:24px 0;text-align:center;">
            <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#f0b000;color:#0d1117;text-decoration:none;border-radius:8px;font-weight:600;">
              Vérifier mon email
            </a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#8b949e;line-height:1.5;">
            Le lien ne fonctionne pas ? Copie-colle cette URL dans ton navigateur :<br />
            <a href="${safeUrl}" style="color:#58a6ff;word-break:break-all;">${safeUrl}</a>
          </p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #30363d;" />
          <p style="margin:0;font-size:11px;color:#8b949e;">
            Si tu n'as pas créé de compte BitQuest, tu peux ignorer ce message.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Bonjour ${pseudo},`,
    "",
    "Clique sur le lien ci-dessous pour confirmer ton adresse email BitQuest :",
    "",
    url,
    "",
    "Si tu n'as pas créé de compte BitQuest, ignore ce message.",
    "",
    "— BitQuest",
  ].join("\n");

  return { to, subject, html, text };
}

/** Échappe les caractères HTML spéciaux pour éviter l'injection dans le template. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
