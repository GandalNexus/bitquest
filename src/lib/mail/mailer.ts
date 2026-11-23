import { logger } from "@/lib/log";

const log = logger("mailer");

/* ============================================================
 * Mailer — abstraction providers.
 *
 * Providers :
 *   - "resend" : API REST, pas de SDK nécessaire (fetch HTTPS)
 *   - "none"   : log-only, idéal pour dev (comportement par défaut
 *                si aucun provider configuré)
 *
 * Config env :
 *   - MAIL_PROVIDER   : "resend" | "none" (défaut)
 *   - MAIL_FROM       : "BitQuest <noreply@bitquest.app>"
 *   - RESEND_API_KEY  : clé Resend (requis si provider=resend)
 * ============================================================ */

export type MailProvider = "resend" | "none";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailResult {
  ok: boolean;
  provider: MailProvider;
  id?: string;
  error?: string;
}

export function getMailProvider(): MailProvider {
  const raw = process.env.MAIL_PROVIDER?.trim().toLowerCase() ?? "";
  if (raw === "resend") return "resend";
  return "none";
}

export function getMailFrom(): string {
  return process.env.MAIL_FROM?.trim() || "BitQuest <noreply@bitquest.app>";
}

/**
 * Point d'entrée public. Dispatch vers le provider actif.
 * Ne jette jamais : les erreurs sont loggées et retournées via
 * `{ ok: false, error }` pour laisser l'appelant décider (dev peut
 * ignorer, prod peut alerter).
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const provider = getMailProvider();
  try {
    if (provider === "resend") return await sendViaResend(message);
    return sendViaNone(message);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ err: error, provider, to: message.to }, "mail send failed");
    return { ok: false, provider, error };
  }
}

/* --------- Provider: none (log-only, dev) --------- */

function sendViaNone(message: MailMessage): MailResult {
  log.info(
    { provider: "none", to: message.to, subject: message.subject },
    "mail: provider=none, printing to logs (configure MAIL_PROVIDER=resend in prod)",
  );
  log.info({ body: message.text }, "mail body (text version)");
  return { ok: true, provider: "none" };
}

/* --------- Provider: Resend (REST) --------- */

interface ResendResponse {
  id?: string;
  message?: string;
  name?: string;
}

async function sendViaResend(message: MailMessage): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    log.warn({}, "resend selected but RESEND_API_KEY absent — falling back to none");
    return sendViaNone(message);
  }
  const from = getMailFrom();
  const body = {
    from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as ResendResponse;
    if (!res.ok) {
      const errorMessage = data.message ?? `resend ${res.status}`;
      log.warn(
        { status: res.status, errorName: data.name, errorMessage, to: message.to },
        "resend send failed",
      );
      return { ok: false, provider: "resend", error: errorMessage };
    }
    log.info({ to: message.to, resendId: data.id }, "mail sent via resend");
    return { ok: true, provider: "resend", id: data.id };
  } finally {
    clearTimeout(timer);
  }
}
