import { describe, it, expect } from "vitest";
import { verificationEmailTemplate } from "./templates";

describe("verificationEmailTemplate", () => {
  it("inclut pseudo + url + subject", () => {
    const m = verificationEmailTemplate({
      to: "alice@example.com",
      pseudo: "alice",
      url: "https://bitquest.app/verify-email?token=abc",
    });
    expect(m.to).toBe("alice@example.com");
    expect(m.subject).toContain("Vérifie");
    expect(m.html).toContain("alice");
    expect(m.html).toContain("https://bitquest.app/verify-email?token=abc");
    expect(m.text).toContain("alice");
    expect(m.text).toContain("https://bitquest.app/verify-email?token=abc");
  });

  it("échappe les caractères HTML dans le pseudo", () => {
    const m = verificationEmailTemplate({
      to: "x@x",
      pseudo: '<script>alert("xss")</script>',
      url: "https://x/y",
    });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("&quot;");
  });

  it("échappe les caractères HTML dans l'URL", () => {
    const m = verificationEmailTemplate({
      to: "x@x",
      pseudo: "alice",
      url: 'https://x/y?token=abc&redirect="evil"',
    });
    // L'attribut href doit toujours contenir l'URL échappée
    expect(m.html).toContain("https://x/y?token=abc&amp;redirect=&quot;evil&quot;");
    // Le text reste brut (pas un contexte HTML)
    expect(m.text).toContain('https://x/y?token=abc&redirect="evil"');
  });

  it("HTML et text contiennent tous deux l'URL", () => {
    const m = verificationEmailTemplate({
      to: "x@x",
      pseudo: "p",
      url: "https://example.com/verify",
    });
    expect(m.html).toContain("https://example.com/verify");
    expect(m.text).toContain("https://example.com/verify");
  });
});
