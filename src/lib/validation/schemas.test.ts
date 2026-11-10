import { describe, it, expect } from "vitest";
import {
  adminChangeRoleSchema,
  authBodySchema,
  parseJsonBody,
  questProgressBodySchema,
} from "./schemas";

/* ------------------------------------------------------------------ */
/* authBodySchema                                                      */
/* ------------------------------------------------------------------ */

describe("authBodySchema — register", () => {
  it("valide un payload register correct", () => {
    const r = authBodySchema.safeParse({
      action: "register",
      email: "test@example.com",
      pseudo: "satoshi",
      password: "motdepasse",
    });
    expect(r.success).toBe(true);
  });

  it("normalise l'email en lowercase + trim", () => {
    const r = authBodySchema.safeParse({
      action: "register",
      email: "  Test@Example.COM  ",
      pseudo: "satoshi",
      password: "motdepasse",
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.action === "register") {
      expect(r.data.email).toBe("test@example.com");
    }
  });

  it("rejette un email mal formé", () => {
    const r = authBodySchema.safeParse({
      action: "register",
      email: "pas-un-email",
      pseudo: "satoshi",
      password: "motdepasse",
    });
    expect(r.success).toBe(false);
  });

  it("rejette un pseudo trop court", () => {
    const r = authBodySchema.safeParse({
      action: "register",
      email: "a@b.c",
      pseudo: "ab",
      password: "motdepasse",
    });
    expect(r.success).toBe(false);
  });

  it("rejette un pseudo trop long", () => {
    const r = authBodySchema.safeParse({
      action: "register",
      email: "a@b.c",
      pseudo: "x".repeat(21),
      password: "motdepasse",
    });
    expect(r.success).toBe(false);
  });

  it("rejette un mot de passe trop court", () => {
    const r = authBodySchema.safeParse({
      action: "register",
      email: "a@b.c",
      pseudo: "satoshi",
      password: "12345",
    });
    expect(r.success).toBe(false);
  });
});

describe("authBodySchema — login + guest", () => {
  it("valide un payload login minimal", () => {
    const r = authBodySchema.safeParse({
      action: "login",
      email: "a@b.c",
      password: "x",
    });
    expect(r.success).toBe(true);
  });

  it("valide un payload guest sans autre champ", () => {
    const r = authBodySchema.safeParse({ action: "guest" });
    expect(r.success).toBe(true);
  });

  it("rejette un action inconnu", () => {
    const r = authBodySchema.safeParse({ action: "foo" });
    expect(r.success).toBe(false);
  });

  it("rejette un payload sans action", () => {
    const r = authBodySchema.safeParse({ email: "a@b.c" });
    expect(r.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* questProgressBodySchema                                             */
/* ------------------------------------------------------------------ */

describe("questProgressBodySchema", () => {
  it("valide start", () => {
    expect(questProgressBodySchema.safeParse({ action: "start" }).success).toBe(true);
  });

  it("valide read_section avec sectionIndex entier positif", () => {
    const r = questProgressBodySchema.safeParse({ action: "read_section", sectionIndex: 0 });
    expect(r.success).toBe(true);
  });

  it("rejette read_section avec sectionIndex négatif", () => {
    expect(questProgressBodySchema.safeParse({ action: "read_section", sectionIndex: -1 }).success).toBe(false);
  });

  it("rejette read_section avec sectionIndex flottant", () => {
    expect(questProgressBodySchema.safeParse({ action: "read_section", sectionIndex: 1.5 }).success).toBe(false);
  });

  it("valide quiz_submit avec un tableau mixte number/boolean", () => {
    const r = questProgressBodySchema.safeParse({
      action: "quiz_submit",
      answers: [0, true, 2, false],
    });
    expect(r.success).toBe(true);
  });

  it("rejette quiz_submit sans tableau answers", () => {
    expect(
      questProgressBodySchema.safeParse({ action: "quiz_submit", answers: "0,1,2" }).success,
    ).toBe(false);
  });

  it("valide mission_start sans payload supplémentaire", () => {
    expect(questProgressBodySchema.safeParse({ action: "mission_start" }).success).toBe(true);
  });

  it("valide mission_submit avec answer vide", () => {
    const r = questProgressBodySchema.safeParse({ action: "mission_submit", answer: {} });
    expect(r.success).toBe(true);
  });

  it("valide mission_submit sans answer (default {})", () => {
    const r = questProgressBodySchema.safeParse({ action: "mission_submit" });
    expect(r.success).toBe(true);
    if (r.success && r.data.action === "mission_submit") {
      expect(r.data.answer).toEqual({});
    }
  });
});

/* ------------------------------------------------------------------ */
/* adminChangeRoleSchema                                               */
/* ------------------------------------------------------------------ */

describe("adminChangeRoleSchema", () => {
  it("accepte les trois rôles valides", () => {
    for (const r of ["APPRENTICE", "EDITOR", "ADMIN"] as const) {
      expect(adminChangeRoleSchema.safeParse({ role: r }).success).toBe(true);
    }
  });

  it("rejette un rôle inconnu", () => {
    expect(adminChangeRoleSchema.safeParse({ role: "GOD" }).success).toBe(false);
  });

  it("rejette un payload sans role", () => {
    expect(adminChangeRoleSchema.safeParse({}).success).toBe(false);
  });

  it("rejette un role non-string", () => {
    expect(adminChangeRoleSchema.safeParse({ role: 1 }).success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* parseJsonBody helper                                                */
/* ------------------------------------------------------------------ */

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("parseJsonBody", () => {
  it("retourne { ok:true, data } sur un payload valide", async () => {
    const req = makeRequest({ action: "guest" });
    const res = await parseJsonBody(req, authBodySchema);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.action).toBe("guest");
  });

  it("retourne un Response 400 sur un JSON mal formé", async () => {
    const req = makeRequest("not-json");
    const res = await parseJsonBody(req, authBodySchema);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(400);
  });

  it("retourne un Response 400 sur un payload refusé par le schéma", async () => {
    const req = makeRequest({ action: "register", email: "x", pseudo: "ab", password: "1" });
    const res = await parseJsonBody(req, authBodySchema);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.status).toBe(400);
      const payload = await res.response.json();
      expect(payload).toHaveProperty("error");
      expect(payload).toHaveProperty("issues");
      expect(Array.isArray(payload.issues)).toBe(true);
    }
  });
});
