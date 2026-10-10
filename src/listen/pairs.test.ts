import { pairLines, type PairEvent } from "./pairs";

const user = (text: string, final = true): PairEvent => ({ kind: "user", text, final });
const tutor = (text: string, final = true): PairEvent => ({ kind: "tutor", text, final });

describe("pairLines", () => {
  it("returns nothing for no events", () => {
    expect(pairLines([])).toEqual([]);
  });

  it("opens a pair on French and closes it when the French is final", () => {
    expect(pairLines([user("On y va ?")])).toEqual([{ id: "p0", fr: "On y va ?", en: "", final: true, kept: false }]);
  });

  it("updates the open pair with partial French", () => {
    const pairs = pairLines([user("On se", false), user("On se voit", false)]);
    expect(pairs).toEqual([{ id: "p0", fr: "On se voit", en: "", final: false, kept: false }]);
    expect(pairLines([user("On se voit", false), user("On se voit demain")])).toEqual([
      { id: "p0", fr: "On se voit demain", en: "", final: true, kept: false },
    ]);
  });

  it("keeps turns apart", () => {
    const pairs = pairLines([user("Bonjour"), user("Ça va ?"), user("Oui", false), user("Oui, merci", false)]);
    expect(pairs.map((p) => [p.id, p.fr, p.final])).toEqual([
      ["p0", "Bonjour", true],
      ["p1", "Ça va ?", true],
      ["p2", "Oui, merci", false],
    ]);
  });

  it("never takes English from tutor text and uses the id prefix", () => {
    const pairs = pairLines([tutor("stray"), user("Salut"), tutor("Hi, how can I help?"), user("Ciao", false), tutor("Bye", false)], "s1-");
    expect(pairs).toEqual([
      { id: "s1-0", fr: "Salut", en: "", final: true, kept: false },
      { id: "s1-1", fr: "Ciao", en: "", final: false, kept: false },
    ]);
  });
});
