import { describe, it, expect } from "vitest";
import {
  LEVEL_THRESHOLDS,
  LEVEL_TITLES,
  QUIZ_PASS_THRESHOLD,
  MISSION_MAX_ATTEMPTS,
  SATS_DAILY_CAP,
  XP_RULES,
  levelFromXp,
  levelInfo,
  updateStreak,
  publicUser,
} from "./progression";

/* ------------------------------------------------------------------ */
/* Constantes métier — on les fige pour empêcher des régressions
   silencieuses sur les valeurs qui pilotent toute l'économie du jeu. */
/* ------------------------------------------------------------------ */

describe("progression — constantes métier", () => {
  it("expose 10 seuils de niveau correctement ordonnés", () => {
    expect(LEVEL_THRESHOLDS).toEqual([0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200]);
    expect(LEVEL_TITLES).toHaveLength(10);
  });

  it("définit les règles d'XP attendues", () => {
    expect(XP_RULES).toMatchObject({
      THEORY_SECTION: 5,
      QUIZ_PASS: 30,
      MISSION_SUCCESS: 50,
      QUEST_BONUS: 20,
    });
  });

  it("définit le seuil quiz (70) et le cap sats journalier (10 000)", () => {
    expect(QUIZ_PASS_THRESHOLD).toBe(70);
    expect(SATS_DAILY_CAP).toBe(10_000);
    expect(MISSION_MAX_ATTEMPTS).toBe(8);
  });
});

/* ------------------------------------------------------------------ */
/* levelFromXp                                                         */
/* ------------------------------------------------------------------ */

describe("levelFromXp", () => {
  it("retourne 1 pour un utilisateur sans XP", () => {
    expect(levelFromXp(0)).toBe(1);
  });

  it("reste au niveau 1 juste en dessous du seuil 100", () => {
    expect(levelFromXp(99)).toBe(1);
  });

  it("passe au niveau 2 pile sur le seuil 100", () => {
    expect(levelFromXp(100)).toBe(2);
  });

  it("retourne le bon niveau pour les 10 seuils exacts", () => {
    for (const [idx, threshold] of LEVEL_THRESHOLDS.entries()) {
      expect(levelFromXp(threshold)).toBe(idx + 1);
    }
  });

  it("plafonne au niveau 10 pour un XP très supérieur au dernier seuil", () => {
    expect(levelFromXp(1_000_000)).toBe(10);
  });

  it("retourne un niveau intermédiaire cohérent entre deux seuils", () => {
    // 250 = niveau 3, 450 = niveau 4 → 300 doit être niveau 3
    expect(levelFromXp(300)).toBe(3);
    // 2500 = niveau 9, 3200 = niveau 10 → 2800 doit être niveau 9
    expect(levelFromXp(2800)).toBe(9);
  });
});

/* ------------------------------------------------------------------ */
/* levelInfo                                                           */
/* ------------------------------------------------------------------ */

describe("levelInfo", () => {
  it("retourne le niveau, le titre et une progression de 0 % pour un utilisateur à 0 XP", () => {
    const info = levelInfo(0);
    expect(info.level).toBe(1);
    expect(info.title).toBe("Novice de la Genèse");
    expect(info.into).toBe(0);
    expect(info.needed).toBe(100);
    expect(info.next).toBe(100);
    expect(info.pct).toBe(0);
  });

  it("calcule une progression exacte à mi-niveau", () => {
    // Niveau 1 entre 0 et 100 → 50 XP = 50 %
    const info = levelInfo(50);
    expect(info.level).toBe(1);
    expect(info.into).toBe(50);
    expect(info.needed).toBe(100);
    expect(info.pct).toBe(50);
  });

  it("calcule correctement la progression au niveau 2", () => {
    // Niveau 2 entre 100 et 250 → 175 XP = 75/150 = 50 %
    const info = levelInfo(175);
    expect(info.level).toBe(2);
    expect(info.into).toBe(75);
    expect(info.needed).toBe(150);
    expect(info.pct).toBe(50);
    expect(info.next).toBe(250);
  });

  it("au niveau 10, retourne next=null et pct=100", () => {
    const info = levelInfo(3200);
    expect(info.level).toBe(10);
    expect(info.title).toBe("Maître Satoshi");
    expect(info.next).toBeNull();
    expect(info.pct).toBe(100);
  });

  it("au niveau 10 avec XP bien au-delà du seuil, reste à pct=100 et next=null", () => {
    const info = levelInfo(50_000);
    expect(info.level).toBe(10);
    expect(info.next).toBeNull();
    expect(info.pct).toBe(100);
  });

  it("borne la progression à 100 % même en cas d'arrondi flottant", () => {
    const info = levelInfo(99);
    expect(info.pct).toBeGreaterThanOrEqual(0);
    expect(info.pct).toBeLessThanOrEqual(100);
  });
});

/* ------------------------------------------------------------------ */
/* updateStreak                                                        */
/* ------------------------------------------------------------------ */

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe("updateStreak", () => {
  it("ne change pas le streak si la dernière activité est aujourd'hui", () => {
    const result = updateStreak({ streak: 5, lastActiveDate: isoDay(0) });
    expect(result).toEqual({ streak: 5, changed: false });
  });

  it("incrémente le streak si la dernière activité était hier", () => {
    const result = updateStreak({ streak: 3, lastActiveDate: isoDay(-1) });
    expect(result).toEqual({ streak: 4, changed: true });
  });

  it("réinitialise le streak à 1 après un saut (pas hier, pas aujourd'hui)", () => {
    const result = updateStreak({ streak: 10, lastActiveDate: isoDay(-3) });
    expect(result).toEqual({ streak: 1, changed: true });
  });

  it("initialise le streak à 1 pour un utilisateur sans date d'activité", () => {
    const result = updateStreak({ streak: 0, lastActiveDate: null });
    expect(result).toEqual({ streak: 1, changed: true });
  });

  it("gère un streak initial à 0 : hier → 1 (pas 0+1)", () => {
    // Cas limite : nouvel utilisateur sans dernière activité, mais streak="hier" forcé en test
    const result = updateStreak({ streak: 0, lastActiveDate: isoDay(-1) });
    expect(result.streak).toBe(1);
    expect(result.changed).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* publicUser                                                          */
/* ------------------------------------------------------------------ */

describe("publicUser", () => {
  const baseUser = {
    id: "u_abc",
    pseudo: "satoshi",
    email: "sato@shi.com",
    isGuest: false,
    xp: 300,
    sats: 150,
    satsEarnedTotal: 500,
    streak: 3,
    lastActiveDate: isoDay(0),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };

  it("retourne tous les champs publics attendus", () => {
    const pub = publicUser(baseUser);
    expect(pub).toMatchObject({
      id: "u_abc",
      pseudo: "satoshi",
      email: "sato@shi.com",
      isGuest: false,
      xp: 300,
      sats: 150,
      satsEarnedTotal: 500,
      streak: 3,
    });
  });

  it("ajoute un levelInfo calculé à partir de l'XP", () => {
    const pub = publicUser(baseUser);
    expect(pub.levelInfo.level).toBe(3);
    expect(pub.levelInfo.title).toBe("Explorateur de Blocs");
  });

  it("ne révèle PAS le champ passwordHash (sécurité)", () => {
    const pub = publicUser(baseUser);
    expect(pub).not.toHaveProperty("passwordHash");
    expect(pub).not.toHaveProperty("token");
  });

  it("préserve le createdAt comme Date (sérialisable JSON côté transport)", () => {
    const pub = publicUser(baseUser);
    expect(pub.createdAt).toBeInstanceOf(Date);
  });

  it("supporte un email null (compte invité)", () => {
    const pub = publicUser({ ...baseUser, email: null, isGuest: true });
    expect(pub.email).toBeNull();
    expect(pub.isGuest).toBe(true);
  });
});
