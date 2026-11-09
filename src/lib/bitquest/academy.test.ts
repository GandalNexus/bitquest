import { describe, it, expect } from "vitest";
import {
  computeCoursePct,
  flattenLessons,
  pickNeighbors,
  selectNextLesson,
} from "./academy";

/* ------------------------------------------------------------------ */
/* computeCoursePct                                                    */
/* ------------------------------------------------------------------ */

describe("computeCoursePct", () => {
  it("retourne 0 pour un cours sans leçons", () => {
    expect(computeCoursePct(0, 0)).toBe(0);
    expect(computeCoursePct(5, 0)).toBe(0);
  });

  it("retourne 0 pour un cours sans leçon terminée", () => {
    expect(computeCoursePct(0, 10)).toBe(0);
  });

  it("retourne 100 lorsque toutes les leçons sont terminées", () => {
    expect(computeCoursePct(10, 10)).toBe(100);
  });

  it("calcule un pourcentage arrondi correct", () => {
    expect(computeCoursePct(1, 3)).toBe(33);
    expect(computeCoursePct(2, 3)).toBe(67);
    expect(computeCoursePct(1, 4)).toBe(25);
  });

  it("borne le résultat entre 0 et 100", () => {
    expect(computeCoursePct(-1, 10)).toBeGreaterThanOrEqual(0);
    expect(computeCoursePct(15, 10)).toBeLessThanOrEqual(100);
  });
});

/* ------------------------------------------------------------------ */
/* flattenLessons                                                      */
/* ------------------------------------------------------------------ */

describe("flattenLessons", () => {
  it("retourne une liste vide sans chapitre", () => {
    expect(flattenLessons([])).toEqual([]);
  });

  it("aplatit par chapter.order puis lesson.order", () => {
    const chapters = [
      {
        order: 2,
        lessons: [
          { id: "l3", slug: "c", order: 2, title: "C" },
          { id: "l2", slug: "b", order: 1, title: "B" },
        ],
      },
      {
        order: 1,
        lessons: [{ id: "l1", slug: "a", order: 1, title: "A" }],
      },
    ];
    const flat = flattenLessons(chapters);
    expect(flat.map((f) => f.id)).toEqual(["l1", "l2", "l3"]);
    expect(flat[0].chapterIndex).toBe(0);
    expect(flat[2].chapterIndex).toBe(1);
  });

  it("ne mute pas les tableaux d'entrée", () => {
    const chapters = [
      {
        order: 1,
        lessons: [
          { id: "l2", slug: "b", order: 2, title: "B" },
          { id: "l1", slug: "a", order: 1, title: "A" },
        ],
      },
    ];
    const snapshot = JSON.stringify(chapters);
    flattenLessons(chapters);
    expect(JSON.stringify(chapters)).toBe(snapshot);
  });
});

/* ------------------------------------------------------------------ */
/* pickNeighbors                                                       */
/* ------------------------------------------------------------------ */

describe("pickNeighbors", () => {
  const flat = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
  ];

  it("retourne null-null pour un id inconnu", () => {
    expect(pickNeighbors(flat, "x")).toEqual({ prev: null, next: null });
  });

  it("retourne prev=null pour la première leçon", () => {
    expect(pickNeighbors(flat, "a")).toEqual({ prev: null, next: { id: "b" } });
  });

  it("retourne next=null pour la dernière leçon", () => {
    expect(pickNeighbors(flat, "c")).toEqual({ prev: { id: "b" }, next: null });
  });

  it("retourne les deux voisins pour une leçon intermédiaire", () => {
    expect(pickNeighbors(flat, "b")).toEqual({ prev: { id: "a" }, next: { id: "c" } });
  });
});

/* ------------------------------------------------------------------ */
/* selectNextLesson                                                    */
/* ------------------------------------------------------------------ */

describe("selectNextLesson", () => {
  const flat = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("retourne la première leçon si aucune n'est terminée", () => {
    expect(selectNextLesson(flat, new Set())).toEqual({ id: "a" });
  });

  it("retourne la première leçon non terminée", () => {
    expect(selectNextLesson(flat, new Set(["a"]))).toEqual({ id: "b" });
    expect(selectNextLesson(flat, new Set(["a", "b"]))).toEqual({ id: "c" });
  });

  it("retourne null si toutes les leçons sont terminées", () => {
    expect(selectNextLesson(flat, new Set(["a", "b", "c"]))).toBeNull();
  });

  it("retourne null sur une liste vide", () => {
    expect(selectNextLesson([], new Set())).toBeNull();
  });
});
