import { pairLines, type PairEvent } from "./pairs";

const user = (text: string, final = true): PairEvent => ({ kind: "user", text, final });
const tutor = (text: string, final = true): PairEvent => ({ kind: "tutor", text, final });

describe("pairLines", () => {
  it("returns nothing for no events", () => {
    expect(pairLines([])).toEqual([]);
  });

  it("opens a pair on French and closes it with the translation", () => {
    expect(pairLines([user("On y va ?"), tutor("Shall we go?")])).toEqual([
      { id: "p0", fr: "On y va ?", en: "Shall we go?", final: true, kept: false },
    ]);
  });

  it("updates the open pair with partial French and partial English", () => {
    const pairs = pairLines([user("On se", false), user("On se voit", false)]);
    expect(pairs).toEqual([{ id: "p0", fr: "On se voit", en: "", final: false, kept: false }]);
    const more = pairLines([user("On se voit", false), user("On se voit demain"), tutor("See you", false)]);
    expect(more).toEqual([{ id: "p0", fr: "On se voit demain", en: "See you", final: false, kept: false }]);
  });

  it("keeps turns apart and handles a translation that lags behind the next utterance", () => {
    const pairs = pairLines([
      user("Bonjour"),
      tutor("Hello"),
      user("Ça va ?"),
      user("Oui", false),
      tutor("How are you?"),
      user("Oui, merci"),
    ]);
    expect(pairs.map((p) => [p.id, p.fr, p.en, p.final])).toEqual([
      ["p0", "Bonjour", "Hello", true],
      ["p1", "Ça va ?", "How are you?", true],
      ["p2", "Oui, merci", "", false],
    ]);
  });

  it("closes an untranslated pair empty when a later one closes", () => {
    const pairs = pairLines([user("hm"), user("Merci beaucoup"), tutor("Thank you very much")]);
    expect(pairs.map((p) => [p.fr, p.en, p.final])).toEqual([
      ["hm", "", true],
      ["Merci beaucoup", "Thank you very much", true],
    ]);
  });

  it("ignores translations with no French to attach to and uses the id prefix", () => {
    expect(pairLines([tutor("stray"), user("Salut"), tutor("Hi")], "s1-")).toEqual([
      { id: "s1-0", fr: "Salut", en: "Hi", final: true, kept: false },
    ]);
  });
});
