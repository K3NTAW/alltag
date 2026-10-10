import * as conversations from "./conversations";

const lines = [
  { fr: "On se voit demain ?", en: "See you tomorrow?", kept: true },
  { fr: "Oui, à midi.", en: "Yes, at noon.", kept: false },
];

describe("conversations", () => {
  beforeEach(() => {
    localStorage.clear();
    conversations.clear();
  });

  it("saves under alltag.conversations with a derived keptCount", () => {
    const c = conversations.save({ startedAt: "2026-10-10T12:00:00.000Z", durationS: 134, lines });
    expect(c.id).toBeTruthy();
    expect(c.keptCount).toBe(1);
    const raw = JSON.parse(localStorage.getItem("alltag.conversations") ?? "[]") as unknown[];
    expect(raw).toEqual([c]);
    expect(conversations.all()).toEqual([c]);
  });

  it("lists newest first and replaces by id", () => {
    conversations.save({ id: "a", startedAt: "2026-10-09T08:00:00.000Z", durationS: 60, lines });
    conversations.save({ id: "b", startedAt: "2026-10-10T08:00:00.000Z", durationS: 60, lines });
    expect(conversations.all().map((c) => c.id)).toEqual(["b", "a"]);
    conversations.save({ id: "a", startedAt: "2026-10-09T08:00:00.000Z", durationS: 90, lines: [] });
    expect(conversations.all()).toHaveLength(2);
    expect(conversations.all()[1]).toMatchObject({ id: "a", durationS: 90, keptCount: 0 });
  });

  it("removes and clears", () => {
    conversations.save({ id: "a", startedAt: "2026-10-09T08:00:00.000Z", durationS: 60, lines });
    conversations.save({ id: "b", startedAt: "2026-10-10T08:00:00.000Z", durationS: 60, lines });
    conversations.remove("a");
    expect(conversations.all().map((c) => c.id)).toEqual(["b"]);
    conversations.clear();
    expect(conversations.all()).toEqual([]);
  });

  it("falls back to memory when localStorage throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const c = conversations.save({ startedAt: "2026-10-10T12:00:00.000Z", durationS: 5, lines });
    expect(conversations.all()).toEqual([c]);
    spy.mockRestore();
    get.mockRestore();
  });
});
