import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ENV_KEYS = ["MAIL_PROVIDER", "MAIL_FROM", "RESEND_API_KEY"] as const;
const savedEnv: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
    delete savedEnv[k];
  }
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

async function load() {
  return import("./mailer");
}

const sampleMessage = {
  to: "alice@example.com",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
};

describe("getMailProvider", () => {
  it("retourne 'none' par défaut", async () => {
    setEnv("MAIL_PROVIDER", undefined);
    const { getMailProvider } = await load();
    expect(getMailProvider()).toBe("none");
  });

  it("retourne 'resend' quand MAIL_PROVIDER=resend", async () => {
    setEnv("MAIL_PROVIDER", "resend");
    const { getMailProvider } = await load();
    expect(getMailProvider()).toBe("resend");
  });

  it("tolère la casse et les espaces", async () => {
    setEnv("MAIL_PROVIDER", "  Resend  ");
    const { getMailProvider } = await load();
    expect(getMailProvider()).toBe("resend");
  });

  it("retombe sur 'none' pour une valeur inconnue", async () => {
    setEnv("MAIL_PROVIDER", "sendgrid");
    const { getMailProvider } = await load();
    expect(getMailProvider()).toBe("none");
  });
});

describe("getMailFrom", () => {
  it("défaut noreply@bitquest.app", async () => {
    setEnv("MAIL_FROM", undefined);
    const { getMailFrom } = await load();
    expect(getMailFrom()).toContain("noreply@bitquest.app");
  });

  it("utilise MAIL_FROM quand fourni", async () => {
    setEnv("MAIL_FROM", "Custom <custom@example.org>");
    const { getMailFrom } = await load();
    expect(getMailFrom()).toBe("Custom <custom@example.org>");
  });
});

describe("sendMail — provider none", () => {
  it("retourne ok=true provider=none sans toucher fetch", async () => {
    setEnv("MAIL_PROVIDER", undefined);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { sendMail } = await load();
    const res = await sendMail(sampleMessage);
    expect(res).toEqual({ ok: true, provider: "none" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sendMail — provider resend", () => {
  it("envoie via Resend avec Authorization Bearer", async () => {
    setEnv("MAIL_PROVIDER", "resend");
    setEnv("RESEND_API_KEY", "re_test_123");
    setEnv("MAIL_FROM", "BitQuest <noreply@bitquest.app>");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_abc" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { sendMail } = await load();
    const res = await sendMail(sampleMessage);

    expect(res).toEqual({ ok: true, provider: "resend", id: "msg_abc" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_123");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["alice@example.com"]);
    expect(body.from).toBe("BitQuest <noreply@bitquest.app>");
    expect(body.subject).toBe("Hello");
  });

  it("retombe sur 'none' quand RESEND_API_KEY manque", async () => {
    setEnv("MAIL_PROVIDER", "resend");
    setEnv("RESEND_API_KEY", undefined);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { sendMail } = await load();
    const res = await sendMail(sampleMessage);
    expect(res).toEqual({ ok: true, provider: "none" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retourne ok=false quand Resend renvoie une erreur", async () => {
    setEnv("MAIL_PROVIDER", "resend");
    setEnv("RESEND_API_KEY", "re_test_123");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "domain not verified", name: "DomainError" }), {
        status: 422,
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { sendMail } = await load();
    const res = await sendMail(sampleMessage);
    expect(res.ok).toBe(false);
    expect(res.provider).toBe("resend");
    expect(res.error).toContain("domain not verified");
  });

  it("ne jette jamais même en cas de fetch failure", async () => {
    setEnv("MAIL_PROVIDER", "resend");
    setEnv("RESEND_API_KEY", "re_test_123");
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { sendMail } = await load();
    const res = await sendMail(sampleMessage);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("network down");
  });
});
