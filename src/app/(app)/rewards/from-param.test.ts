import { describe, expect, it } from "vitest";
import { parseQuestCodeHint } from "./from-param";

describe("parseQuestCodeHint", () => {
  it("accepte un slug valide typique", () => {
    expect(parseQuestCodeHint("genesis")).toBe("genesis");
    expect(parseQuestCodeHint("tx-basics")).toBe("tx-basics");
    expect(parseQuestCodeHint("multi_sig_42")).toBe("multi_sig_42");
  });

  it("accepte lettres + chiffres + tirets + underscores", () => {
    expect(parseQuestCodeHint("abc123_def-456")).toBe("abc123_def-456");
  });

  it("rejette undefined / null / non-string", () => {
    expect(parseQuestCodeHint(undefined)).toBeNull();
    expect(parseQuestCodeHint(null)).toBeNull();
    // @ts-expect-error — vérifie la défense runtime
    expect(parseQuestCodeHint(42)).toBeNull();
    // @ts-expect-error
    expect(parseQuestCodeHint({})).toBeNull();
  });

  it("rejette une chaîne vide", () => {
    expect(parseQuestCodeHint("")).toBeNull();
  });

  it("rejette une chaîne > 40 caractères", () => {
    expect(parseQuestCodeHint("a".repeat(41))).toBeNull();
    expect(parseQuestCodeHint("a".repeat(40))).toBe("a".repeat(40));
  });

  it("rejette majuscules (le slug doit être en lowercase strict)", () => {
    expect(parseQuestCodeHint("Genesis")).toBeNull();
    expect(parseQuestCodeHint("ABC")).toBeNull();
  });

  it("rejette tout caractère hors [a-z0-9_-]", () => {
    expect(parseQuestCodeHint("quest.title")).toBeNull();
    expect(parseQuestCodeHint("quest title")).toBeNull();
    expect(parseQuestCodeHint("quest/title")).toBeNull();
    expect(parseQuestCodeHint("quest?title")).toBeNull();
  });

  it("rejette les tentatives d'injection HTML / JS", () => {
    expect(parseQuestCodeHint("<script>")).toBeNull();
    expect(parseQuestCodeHint("javascript:alert(1)")).toBeNull();
    expect(parseQuestCodeHint("../../etc/passwd")).toBeNull();
    expect(parseQuestCodeHint("' OR 1=1--")).toBeNull();
  });
});
