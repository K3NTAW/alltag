import type { Card, SceneResult } from "../lib/types";
import { findRecall, gradeFromTranscript, normalizeNoun } from "./recall";

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const scene: SceneResult = {
  place: "café",
  task: { fr: "commande un café", en: "order a coffee", role: "serveur" },
  objects: [
    {
      id: "o1",
      fr: "machine à café",
      en: "coffee machine",
      article: "la",
      gender: "f",
      plural: "machines à café",
      level: "A1",
      phrase_fr: "la machine à café est chaude",
      phrase_en: "the coffee machine is hot",
    },
  ],
};

function card(over: Partial<Card>): Card {
  return {
    id: "c",
    phrase_fr: "la machine à café est chaude",
    phrase_en: "the coffee machine is hot",
    ease: 2.5,
    interval: 1,
    reps: 1,
    due: NOW - DAY,
    learnedAt: NOW - 2 * DAY,
    ...over,
  };
}

describe("normalizeNoun", () => {
  it("drops articles and accents", () => {
    expect(normalizeNoun(" La Machine à Café ")).toBe("machine a cafe");
    expect(normalizeNoun("l'eau")).toBe("eau");
    expect(normalizeNoun("des œufs")).toBe("œufs");
  });
});

describe("findRecall", () => {
  it("matches the due card ignoring article and accents", () => {
    const c = card({ id: "a", noun_fr: "la machine à café" });
    expect(findRecall(scene, [c], NOW)?.id).toBe("a");
  });

  it("returns null when not due", () => {
    const c = card({ id: "a", noun_fr: "la machine à café", due: NOW + DAY });
    expect(findRecall(scene, [c], NOW)).toBeNull();
  });

  it("returns null when no noun matches", () => {
    const c = card({ id: "a", noun_fr: "la tasse" });
    expect(findRecall(scene, [c], NOW)).toBeNull();
  });

  it("picks the earliest due of two matches", () => {
    const late = card({ id: "late", noun_fr: "la machine à café", due: NOW - DAY });
    const early = card({ id: "early", noun_fr: "machine a cafe", due: NOW - 3 * DAY });
    expect(findRecall(scene, [late, early], NOW)?.id).toBe("early");
  });
});

describe("gradeFromTranscript", () => {
  it("grades an exact match 5", () => {
    expect(gradeFromTranscript("je voudrais un café", "je voudrais un café")).toBe(5);
  });

  it("grades a partial below 5", () => {
    expect(gradeFromTranscript("un café", "je voudrais un café s'il vous plaît")).toBeLessThan(5);
  });

  it("grades empty 0", () => {
    expect(gradeFromTranscript("  ", "je voudrais un café")).toBe(0);
  });
});
