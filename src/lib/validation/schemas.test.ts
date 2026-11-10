import { describe, it, expect } from "vitest";
import {
  adminChangeRoleSchema,
  adminChapterCreateSchema,
  adminChapterUpdateSchema,
  adminCourseCreateSchema,
  adminCourseUpdateSchema,
  adminLessonCreateSchema,
  adminLessonUpdateSchema,
  adminQuestMissionSchema,
  adminQuestQuizSchema,
  adminQuestTheorySchema,
  adminQuestUpdateSchema,
  authBodySchema,
  parseJsonBody,
  questProgressBodySchema,
  slugSchema,
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
/* slugSchema                                                          */
/* ------------------------------------------------------------------ */

describe("slugSchema", () => {
  it("accepte un slug kebab-case valide", () => {
    for (const s of ["bitcoin", "fondamentaux-bitcoin", "ln-channels", "a1-b2"]) {
      expect(slugSchema.safeParse(s).success).toBe(true);
    }
  });

  it("normalise en lowercase et trim", () => {
    const r = slugSchema.safeParse("  Bitcoin-101  ");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("bitcoin-101");
  });

  it("rejette les slugs trop courts ou trop longs", () => {
    expect(slugSchema.safeParse("a").success).toBe(false);
    expect(slugSchema.safeParse("x".repeat(81)).success).toBe(false);
  });

  it("rejette les caractères non autorisés (accents, _ , / , espaces)", () => {
    expect(slugSchema.safeParse("héhé").success).toBe(false);
    expect(slugSchema.safeParse("snake_case").success).toBe(false);
    expect(slugSchema.safeParse("bit/coin").success).toBe(false);
    expect(slugSchema.safeParse("avec espace").success).toBe(false);
  });

  it("rejette un slug commençant ou finissant par -", () => {
    expect(slugSchema.safeParse("-bitcoin").success).toBe(false);
    expect(slugSchema.safeParse("bitcoin-").success).toBe(false);
    expect(slugSchema.safeParse("a--b").success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* adminCourseCreateSchema / adminCourseUpdateSchema                   */
/* ------------------------------------------------------------------ */

describe("adminCourseCreateSchema", () => {
  const base = {
    slug: "fondamentaux-bitcoin",
    title: "Fondamentaux Bitcoin",
    subtitle: "Comprendre Bitcoin de l'intérieur.",
    description: "Un parcours complet pour maîtriser les bases.",
  };

  it("valide un payload minimal (defaults appliqués)", () => {
    const r = adminCourseCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.coverIcon).toBe("BookOpen"); // default
      expect(r.data.order).toBe(0); // default
    }
  });

  it("accepte publishedAt null ou une date ISO", () => {
    expect(adminCourseCreateSchema.safeParse({ ...base, publishedAt: null }).success).toBe(true);
    expect(
      adminCourseCreateSchema.safeParse({ ...base, publishedAt: new Date().toISOString() }).success,
    ).toBe(true);
  });

  it("rejette publishedAt non-ISO", () => {
    expect(
      adminCourseCreateSchema.safeParse({ ...base, publishedAt: "yesterday" }).success,
    ).toBe(false);
  });

  it("rejette un titre vide ou trop long", () => {
    expect(adminCourseCreateSchema.safeParse({ ...base, title: "" }).success).toBe(false);
    expect(adminCourseCreateSchema.safeParse({ ...base, title: "x".repeat(121) }).success).toBe(
      false,
    );
  });

  it("rejette un slug mal formé", () => {
    expect(adminCourseCreateSchema.safeParse({ ...base, slug: "invalide_ici" }).success).toBe(
      false,
    );
  });

  it("rejette un order négatif ou non-entier", () => {
    expect(adminCourseCreateSchema.safeParse({ ...base, order: -1 }).success).toBe(false);
    expect(adminCourseCreateSchema.safeParse({ ...base, order: 1.5 }).success).toBe(false);
  });
});

describe("adminCourseUpdateSchema", () => {
  it("accepte un objet vide (patch sans champ)", () => {
    expect(adminCourseUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepte un patch partiel", () => {
    const r = adminCourseUpdateSchema.safeParse({ title: "Nouveau titre" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ title: "Nouveau titre" });
  });

  it("valide les mêmes contraintes que create pour les champs fournis", () => {
    expect(adminCourseUpdateSchema.safeParse({ slug: "bad_slug" }).success).toBe(false);
    expect(adminCourseUpdateSchema.safeParse({ order: -3 }).success).toBe(false);
  });

  it("accepte publishedAt null pour dépublier", () => {
    expect(adminCourseUpdateSchema.safeParse({ publishedAt: null }).success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* adminChapterCreateSchema / adminChapterUpdateSchema                 */
/* ------------------------------------------------------------------ */

describe("adminChapterCreateSchema", () => {
  const base = { slug: "propriete-numerique", title: "Propriété numérique", summary: "Court résumé" };

  it("valide un payload minimal (order default 0)", () => {
    const r = adminChapterCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.order).toBe(0);
  });

  it("rejette un slug mal formé", () => {
    expect(adminChapterCreateSchema.safeParse({ ...base, slug: "bad_slug" }).success).toBe(false);
  });

  it("rejette un summary trop long", () => {
    expect(adminChapterCreateSchema.safeParse({ ...base, summary: "x".repeat(501) }).success).toBe(
      false,
    );
  });
});

describe("adminChapterUpdateSchema", () => {
  it("accepte un patch vide", () => {
    expect(adminChapterUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("valide un patch partiel", () => {
    const r = adminChapterUpdateSchema.safeParse({ title: "Nouveau titre" });
    expect(r.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* adminLessonCreateSchema / adminLessonUpdateSchema                   */
/* ------------------------------------------------------------------ */

describe("adminLessonCreateSchema", () => {
  const base = {
    slug: "pourquoi-bitcoin",
    title: "Pourquoi Bitcoin ?",
    summary: "Les motivations",
    content: "## Intro\n\nContenu Markdown.",
  };

  it("valide un payload minimal (defaults appliqués)", () => {
    const r = adminLessonCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.estimatedMinutes).toBe(5);
      expect(r.data.order).toBe(0);
    }
  });

  it("accepte publishedAt null et ISO", () => {
    expect(adminLessonCreateSchema.safeParse({ ...base, publishedAt: null }).success).toBe(true);
    expect(
      adminLessonCreateSchema.safeParse({ ...base, publishedAt: new Date().toISOString() }).success,
    ).toBe(true);
  });

  it("rejette estimatedMinutes <= 0 ou > 240", () => {
    expect(adminLessonCreateSchema.safeParse({ ...base, estimatedMinutes: 0 }).success).toBe(false);
    expect(adminLessonCreateSchema.safeParse({ ...base, estimatedMinutes: 241 }).success).toBe(
      false,
    );
  });

  it("rejette un content trop court ou trop long", () => {
    expect(adminLessonCreateSchema.safeParse({ ...base, content: "x" }).success).toBe(false);
    expect(adminLessonCreateSchema.safeParse({ ...base, content: "x".repeat(50_001) }).success).toBe(
      false,
    );
  });
});

describe("adminLessonUpdateSchema", () => {
  it("accepte un patch vide", () => {
    expect(adminLessonUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepte publishedAt null pour dépublier", () => {
    expect(adminLessonUpdateSchema.safeParse({ publishedAt: null }).success).toBe(true);
  });

  it("applique les contraintes du create sur les champs fournis", () => {
    expect(adminLessonUpdateSchema.safeParse({ estimatedMinutes: 500 }).success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* adminQuestUpdateSchema                                              */
/* ------------------------------------------------------------------ */

describe("adminQuestUpdateSchema", () => {
  it("accepte un patch vide", () => {
    expect(adminQuestUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepte un patch partiel", () => {
    expect(adminQuestUpdateSchema.safeParse({ title: "New" }).success).toBe(true);
    expect(adminQuestUpdateSchema.safeParse({ xpReward: 100, satsReward: 500 }).success).toBe(true);
  });

  it("accepte les quatre tracks valides", () => {
    for (const t of ["INITIATION", "INTERMEDIATE", "ADVANCED", "SPECIAL"]) {
      expect(adminQuestUpdateSchema.safeParse({ track: t }).success).toBe(true);
    }
  });

  it("rejette un track inconnu", () => {
    expect(adminQuestUpdateSchema.safeParse({ track: "SECRET" }).success).toBe(false);
  });

  it("borne xpReward entre 0 et 10 000", () => {
    expect(adminQuestUpdateSchema.safeParse({ xpReward: -1 }).success).toBe(false);
    expect(adminQuestUpdateSchema.safeParse({ xpReward: 10_001 }).success).toBe(false);
    expect(adminQuestUpdateSchema.safeParse({ xpReward: 10_000 }).success).toBe(true);
  });

  it("borne satsReward entre 0 et 1 000 000", () => {
    expect(adminQuestUpdateSchema.safeParse({ satsReward: -1 }).success).toBe(false);
    expect(adminQuestUpdateSchema.safeParse({ satsReward: 1_000_001 }).success).toBe(false);
    expect(adminQuestUpdateSchema.safeParse({ satsReward: 1_000_000 }).success).toBe(true);
  });

  it("borne requiredLevel entre 1 et 10", () => {
    expect(adminQuestUpdateSchema.safeParse({ requiredLevel: 0 }).success).toBe(false);
    expect(adminQuestUpdateSchema.safeParse({ requiredLevel: 11 }).success).toBe(false);
    expect(adminQuestUpdateSchema.safeParse({ requiredLevel: 1 }).success).toBe(true);
    expect(adminQuestUpdateSchema.safeParse({ requiredLevel: 10 }).success).toBe(true);
  });

  it("rejette un title trop long", () => {
    expect(adminQuestUpdateSchema.safeParse({ title: "x".repeat(121) }).success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* adminQuestTheorySchema                                              */
/* ------------------------------------------------------------------ */

describe("adminQuestTheorySchema", () => {
  const validSection = { title: "S1", body: "Corps.", keypoints: ["un", "deux"] };

  it("valide un tableau d'une section minimale", () => {
    const r = adminQuestTheorySchema.safeParse({ sections: [validSection] });
    expect(r.success).toBe(true);
  });

  it("keypoints default [] si omis", () => {
    const r = adminQuestTheorySchema.safeParse({
      sections: [{ title: "S", body: "Corps" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sections[0].keypoints).toEqual([]);
  });

  it("rejette un tableau vide", () => {
    expect(adminQuestTheorySchema.safeParse({ sections: [] }).success).toBe(false);
  });

  it("rejette plus de 12 sections", () => {
    const many = Array.from({ length: 13 }, () => validSection);
    expect(adminQuestTheorySchema.safeParse({ sections: many }).success).toBe(false);
  });

  it("rejette une section avec titre vide", () => {
    expect(
      adminQuestTheorySchema.safeParse({ sections: [{ title: "", body: "x" }] }).success,
    ).toBe(false);
  });

  it("rejette une section avec body vide", () => {
    expect(
      adminQuestTheorySchema.safeParse({ sections: [{ title: "x", body: "" }] }).success,
    ).toBe(false);
  });

  it("rejette plus de 20 keypoints dans une section", () => {
    const section = { title: "x", body: "y", keypoints: Array.from({ length: 21 }, () => "k") };
    expect(adminQuestTheorySchema.safeParse({ sections: [section] }).success).toBe(false);
  });

  it("rejette un payload qui dépasse 80 KB sérialisés", () => {
    const bigBody = "x".repeat(9_999);
    const sections = Array.from({ length: 12 }, () => ({ title: "t", body: bigBody, keypoints: [] }));
    expect(adminQuestTheorySchema.safeParse({ sections }).success).toBe(false);
  });

  it("borne title à 200 et body à 10 000 caractères", () => {
    expect(
      adminQuestTheorySchema.safeParse({
        sections: [{ title: "x".repeat(201), body: "ok" }],
      }).success,
    ).toBe(false);
    expect(
      adminQuestTheorySchema.safeParse({
        sections: [{ title: "ok", body: "x".repeat(10_001) }],
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* adminQuestQuizSchema                                                */
/* ------------------------------------------------------------------ */

describe("adminQuestQuizSchema — MCQ", () => {
  const validMcq = {
    type: "MCQ" as const,
    question: "Quel est le bloc 0 ?",
    options: ["Genesis", "Bloc miné en 2010", "Rien de spécial"],
    correctIndex: 0,
    explanation: "Satoshi a miné le bloc genesis le 3 janvier 2009.",
  };

  it("valide un MCQ bien formé", () => {
    expect(adminQuestQuizSchema.safeParse({ questions: [validMcq] }).success).toBe(true);
  });

  it("rejette moins de 2 options", () => {
    expect(
      adminQuestQuizSchema.safeParse({ questions: [{ ...validMcq, options: ["un"] }] }).success,
    ).toBe(false);
  });

  it("rejette plus de 6 options", () => {
    expect(
      adminQuestQuizSchema.safeParse({
        questions: [{ ...validMcq, options: ["a", "b", "c", "d", "e", "f", "g"] }],
      }).success,
    ).toBe(false);
  });

  it("rejette correctIndex hors plage via refine", () => {
    expect(
      adminQuestQuizSchema.safeParse({ questions: [{ ...validMcq, correctIndex: 5 }] }).success,
    ).toBe(false);
    expect(
      adminQuestQuizSchema.safeParse({ questions: [{ ...validMcq, correctIndex: -1 }] }).success,
    ).toBe(false);
  });

  it("rejette une option vide (après trim/min 1)", () => {
    expect(
      adminQuestQuizSchema.safeParse({
        questions: [{ ...validMcq, options: ["ok", "   "] }],
      }).success,
    ).toBe(false);
  });
});

describe("adminQuestQuizSchema — TRUE_FALSE", () => {
  const validTf = {
    type: "TRUE_FALSE" as const,
    question: "Bitcoin a été lancé en 2009.",
    correctBool: true,
    explanation: "Oui, bloc 0 miné le 3 janvier 2009.",
  };

  it("valide une question Vrai/Faux", () => {
    expect(adminQuestQuizSchema.safeParse({ questions: [validTf] }).success).toBe(true);
  });

  it("rejette correctBool non booléen", () => {
    expect(
      adminQuestQuizSchema.safeParse({
        questions: [{ ...validTf, correctBool: "true" }],
      }).success,
    ).toBe(false);
  });

  it("rejette correctBool manquant", () => {
    const { correctBool, ...withoutBool } = validTf;
    void correctBool;
    expect(
      adminQuestQuizSchema.safeParse({ questions: [withoutBool] }).success,
    ).toBe(false);
  });
});

describe("adminQuestQuizSchema — wrapper", () => {
  it("rejette un questions=[] (min 1)", () => {
    expect(adminQuestQuizSchema.safeParse({ questions: [] }).success).toBe(false);
  });

  it("rejette plus de 20 questions", () => {
    const base = {
      type: "TRUE_FALSE" as const,
      question: "q",
      correctBool: true,
      explanation: "e",
    };
    const many = Array.from({ length: 21 }, () => base);
    expect(adminQuestQuizSchema.safeParse({ questions: many }).success).toBe(false);
  });

  it("accepte un mix MCQ + TF", () => {
    const r = adminQuestQuizSchema.safeParse({
      questions: [
        {
          type: "MCQ",
          question: "x",
          options: ["a", "b"],
          correctIndex: 1,
          explanation: "e",
        },
        {
          type: "TRUE_FALSE",
          question: "y",
          correctBool: false,
          explanation: "e",
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejette un type inconnu (discriminator)", () => {
    expect(
      adminQuestQuizSchema.safeParse({
        questions: [{ type: "OPEN_ENDED", question: "x", explanation: "e" }],
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* adminQuestMissionSchema                                             */
/* ------------------------------------------------------------------ */

describe("adminQuestMissionSchema", () => {
  const base = {
    missionType: "block_explorer" as const,
    brief: "Trouve les 6 derniers caractères du hash du bloc.",
  };

  it("valide le payload minimal (hint default, config default)", () => {
    const r = adminQuestMissionSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.hint).toBe("");
      expect(r.data.config).toEqual({});
    }
  });

  it("accepte les 8 missionType supportés", () => {
    const types = [
      "block_explorer",
      "key_forge",
      "tx_builder",
      "mine_nonce",
      "ln_channel",
      "ln_invoice",
      "multisig_sign",
      "taproot_tweak",
    ];
    for (const t of types) {
      expect(adminQuestMissionSchema.safeParse({ ...base, missionType: t }).success).toBe(true);
    }
  });

  it("rejette un missionType inconnu", () => {
    expect(
      adminQuestMissionSchema.safeParse({ ...base, missionType: "quantum_hash" }).success,
    ).toBe(false);
  });

  it("rejette un brief vide", () => {
    expect(adminQuestMissionSchema.safeParse({ ...base, brief: "" }).success).toBe(false);
  });

  it("accepte un config JSON type-spécifique", () => {
    const r = adminQuestMissionSchema.safeParse({
      ...base,
      missionType: "tx_builder",
      config: { variant: "payment", target: 45_000, feeSats: { slow: 800, fast: 5000 } },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.config.variant).toBe("payment");
    }
  });

  it("rejette un config qui n'est pas un objet (tableau, string)", () => {
    expect(
      adminQuestMissionSchema.safeParse({ ...base, config: [1, 2, 3] }).success,
    ).toBe(false);
    expect(
      adminQuestMissionSchema.safeParse({ ...base, config: "nope" }).success,
    ).toBe(false);
  });

  it("borne brief à 2000 et hint à 1000 caractères", () => {
    expect(
      adminQuestMissionSchema.safeParse({ ...base, brief: "x".repeat(2001) }).success,
    ).toBe(false);
    expect(
      adminQuestMissionSchema.safeParse({ ...base, hint: "x".repeat(1001) }).success,
    ).toBe(false);
  });

  it("rejette si la sérialisation dépasse 20 KB", () => {
    const huge = "x".repeat(21_000);
    expect(
      adminQuestMissionSchema.safeParse({ ...base, config: { blob: huge } }).success,
    ).toBe(false);
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
