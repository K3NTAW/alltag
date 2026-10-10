import type { Card } from "../lib/types";
import { addRestored, all, byNoun, clear, due, get, grade, keep, remove, subscribe } from "./store";

const DAY = 24 * 60 * 60 * 1000;

function fresh() {
  return keep({ phrase_fr: "un café, s'il vous plaît", phrase_en: "a coffee, please", noun_fr: "le café" });
}

describe("srs store", () => {
  beforeEach(() => {
    localStorage.clear();
    clear();
  });

  it("persists under alltag.cards", () => {
    const card = fresh();
    const raw = JSON.parse(localStorage.getItem("alltag.cards") ?? "[]") as { id: string }[];
    expect(raw.map((c) => c.id)).toEqual([card.id]);
    expect(get(card.id)?.ease).toBe(2.5);
  });

  it("grades 5 three times: intervals 1, 6, round(6 * ease)", () => {
    const card = fresh();
    const now = 1_000_000;
    const a = grade(card.id, 5, now);
    expect(a.interval).toBe(1);
    expect(a.reps).toBe(1);
    expect(a.ease).toBeCloseTo(2.6);
    expect(a.due).toBe(now + DAY);
    const b = grade(card.id, 5, now);
    expect(b.interval).toBe(6);
    expect(b.ease).toBeCloseTo(2.7);
    const c = grade(card.id, 5, now);
    expect(c.interval).toBe(Math.round(6 * b.ease));
    expect(c.ease).toBeCloseTo(2.8);
    expect(c.reps).toBe(3);
  });

  it("grade 2 resets interval to 1 and reps to 0", () => {
    const card = fresh();
    grade(card.id, 5);
    grade(card.id, 5);
    const r = grade(card.id, 2);
    expect(r.interval).toBe(1);
    expect(r.reps).toBe(0);
    expect(r.ease).toBeCloseTo(2.7 - 0.32);
  });

  it("keep is idempotent per noun and errorType", () => {
    const a = fresh();
    const b = fresh();
    expect(b).toEqual(a);
    expect(all()).toHaveLength(1);
    keep({ phrase_fr: "le café", phrase_en: "the coffee", noun_fr: "le café", errorType: "article" });
    expect(all()).toHaveLength(2);
    expect(byNoun("le café")?.id).toBe(a.id);
  });

  it("due excludes cards due in the future", () => {
    const now = Date.now();
    const a = fresh();
    const b = keep({ phrase_fr: "la table", phrase_en: "the table", noun_fr: "la table" });
    grade(b.id, 5, now);
    expect(due(now + 1000).map((c) => c.id)).toEqual([a.id]);
    remove(a.id);
    expect(due(now + 1000)).toEqual([]);
  });
});

describe("srs store hooks", () => {
  beforeEach(() => {
    localStorage.clear();
    clear();
  });

  function restored(id: string, phrase_fr = id): Card {
    return { id, phrase_fr, phrase_en: "", ease: 2.5, interval: 0, reps: 0, due: 0, learnedAt: 0 };
  }

  it("subscribe fires after keep, grade, remove and clear; unsubscribe stops it", () => {
    const fn = vi.fn();
    const unsubscribe = subscribe(fn);
    const card = fresh();
    expect(fn).toHaveBeenCalledTimes(1);
    grade(card.id, 5);
    expect(fn).toHaveBeenCalledTimes(2);
    remove(card.id);
    expect(fn).toHaveBeenCalledTimes(3);
    clear();
    expect(fn).toHaveBeenCalledTimes(4);
    unsubscribe();
    fresh();
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("addRestored skips local ids and in-batch twins, first wins, saves once", () => {
    const local = fresh();
    const fn = vi.fn();
    subscribe(fn);
    const n = addRestored([restored(local.id, "remote"), restored("a", "first"), restored("a", "second"), restored("b")]);
    expect(n).toBe(2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(get(local.id)).toEqual(local);
    expect(get("a")?.phrase_fr).toBe("first");
    expect(all().map((c) => c.id)).toEqual([local.id, "a", "b"]);
    expect(addRestored([restored("a"), restored(local.id)])).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
