import { fireEvent, render, screen } from "@testing-library/react";
import * as conversations from "../srs/conversations";
import * as store from "../srs/store";
import Diary from "./Diary";

describe("Diary", () => {
  beforeEach(() => {
    localStorage.clear();
    store.clear();
    conversations.clear();
  });

  it("renders one tile per kept card with phrase and ISO date", () => {
    store.keep({ phrase_fr: "la machine à café", phrase_en: "the coffee machine", noun_fr: "machine", place: "café" });
    store.keep({ phrase_fr: "une tasse", phrase_en: "a cup", noun_fr: "tasse", place: "café" });
    store.keep({ phrase_fr: "un billet", phrase_en: "a ticket", noun_fr: "billet", place: "gare" });

    render(<Diary />);
    expect(screen.getByText("what you can say now")).toBeInTheDocument();
    const tiles = screen.getAllByTestId("diary-tile");
    expect(tiles).toHaveLength(3);
    for (const phrase of ["la machine à café", "une tasse", "un billet"]) {
      expect(screen.getByText(phrase)).toBeInTheDocument();
    }
    for (const tile of tiles) {
      expect(tile.textContent).toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  it("renders the empty state", () => {
    render(<Diary />);
    expect(screen.queryAllByTestId("diary-tile")).toHaveLength(0);
    expect(screen.getByText("nothing kept yet, go look at something")).toBeInTheDocument();
  });

  it("renders a conversation row interleaved by date and expands its lines", () => {
    const old = new Date(2026, 9, 9, 9, 0).getTime();
    vi.spyOn(Date, "now").mockReturnValue(old);
    store.keep({ phrase_fr: "une tasse", phrase_en: "a cup", noun_fr: "tasse", place: "café" });
    vi.restoreAllMocks();
    conversations.save({
      startedAt: new Date(2026, 9, 10, 14, 5).toISOString(),
      durationS: 134,
      lines: [
        { fr: "On se voit demain ?", en: "See you tomorrow?", kept: true },
        { fr: "Oui, à midi.", en: "Yes, at noon.", kept: false },
      ],
    });

    render(<Diary />);
    const row = screen.getByTestId("diary-conversation");
    expect(row.textContent).toContain("conversation, sat 14:05");
    expect(row.textContent).toContain("2 lines, 1 kept");
    // newest first: the conversation comes before the older scene tile
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toBe(row);
    expect(screen.queryByText("Oui, à midi.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /conversation, sat 14:05/ }));
    expect(screen.getByText("Oui, à midi.")).toBeInTheDocument();
    expect(screen.getByText("See you tomorrow?")).toBeInTheDocument();
  });

  it("filters scenes and conversations with the chips", () => {
    store.keep({ phrase_fr: "une tasse", phrase_en: "a cup", noun_fr: "tasse", place: "café" });
    conversations.save({ startedAt: new Date().toISOString(), durationS: 60, lines: [] });

    render(<Diary />);
    expect(screen.getAllByTestId("diary-tile")).toHaveLength(1);
    expect(screen.getAllByTestId("diary-conversation")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "scenes" }));
    expect(screen.getAllByTestId("diary-tile")).toHaveLength(1);
    expect(screen.queryByTestId("diary-conversation")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "conversations" }));
    expect(screen.queryByTestId("diary-tile")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("diary-conversation")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "conversations" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "all" }));
    expect(screen.getAllByTestId("diary-tile")).toHaveLength(1);
    expect(screen.getAllByTestId("diary-conversation")).toHaveLength(1);
  });
});
