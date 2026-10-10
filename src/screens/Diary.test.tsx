import { render, screen } from "@testing-library/react";
import * as store from "../srs/store";
import Diary from "./Diary";

describe("Diary", () => {
  beforeEach(() => {
    localStorage.clear();
    store.clear();
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
});
