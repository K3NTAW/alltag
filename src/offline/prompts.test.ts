import type { SceneResult } from "../lib/types";
import { correctPrompt, parseCorrect, parseTurn, turnPrompt } from "./prompts";

const scene: SceneResult = {
  place: "café",
  objects: [],
  task: { fr: "commande un café", en: "order a coffee", role: "serveur" },
};

describe("prompts", () => {
  it("builds short French JSON-only prompts", () => {
    const t = turnPrompt({ scene, history: [{ role: "tutor", text: "bonjour" }], userText: "un café", level: "A1" });
    expect(t).toContain("commande un café");
    expect(t).toContain("Élève: un café");
    expect(t).toContain("JSON");
    const c = correctPrompt({ scene, userText: "je veux café", level: "A2" });
    expect(c).toContain('"je veux café"');
    expect(c).toContain("JSON");
  });
});

describe("parseTurn", () => {
  it("reads clean JSON", () => {
    expect(parseTurn('{"reply_fr":"voilà","reply_en":"here","task_done":true}')).toEqual({
      reply_fr: "voilà",
      reply_en: "here",
      task_done: true,
    });
  });

  it("reads JSON inside prose and code fences", () => {
    const raw = 'Bien sûr ! ```json\n{"reply_fr": "un café {chaud}", "reply_en": "a hot coffee", "task_done": false}\n``` voilà';
    expect(parseTurn(raw)).toEqual({ reply_fr: "un café {chaud}", reply_en: "a hot coffee", task_done: false });
  });

  it("falls back on garbage", () => {
    const fallback = { reply_fr: "pardon, tu peux répéter ?", reply_en: "sorry, can you repeat?", task_done: false };
    expect(parseTurn("je ne sais pas")).toEqual(fallback);
    expect(parseTurn('{"reply_fr": ')).toEqual(fallback);
    expect(parseTurn('{"other": 1}')).toEqual(fallback);
  });
});

describe("parseCorrect", () => {
  it("reads clean JSON and drops bad items", () => {
    const raw = JSON.stringify({
      corrections: [
        { said: "je veux", better: "je voudrais", type: "register", why_en: "polite" },
        { said: "x", better: "y", type: "spelling", why_en: "unknown type" },
        { said: "same", better: "same", type: "vocab", why_en: "no change" },
      ],
      kept_phrase_fr: "je voudrais un café",
    });
    expect(parseCorrect(raw)).toEqual({
      corrections: [{ said: "je veux", better: "je voudrais", type: "register", why_en: "polite" }],
      kept_phrase_fr: "je voudrais un café",
    });
  });

  it("reads JSON inside prose", () => {
    const raw = 'Voici: {"corrections": [], "kept_phrase_fr": "un café"} merci';
    expect(parseCorrect(raw)).toEqual({ corrections: [], kept_phrase_fr: "un café" });
  });

  it("falls back on garbage", () => {
    expect(parseCorrect("nope").corrections).toEqual([]);
    expect(parseCorrect("{broken").corrections).toEqual([]);
  });
});
