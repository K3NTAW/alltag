import { fireEvent, render, screen } from "@testing-library/react";
import { go, useScreen } from "../lib/screen";
import { resetSession, session } from "../lib/session";
import * as store from "../srs/store";
import Corrections from "./Corrections";

function ScreenProbe() {
  const { screen: s } = useScreen();
  return <span data-testid="screen">{s}</span>;
}

describe("Corrections", () => {
  beforeEach(() => {
    localStorage.clear();
    store.clear();
    resetSession();
    go("corrections");
    session.scene = {
      place: "café",
      objects: [],
      task: { fr: "commande un café", en: "order a coffee", role: "serveur" },
    };
    session.frame = "data:image/jpeg;base64,AAAA";
    session.lastExchange = {
      transcript: [{ role: "learner", text: "je veux le café" }],
      corrections: [
        { said: "je veux le café", better: "je voudrais un café", type: "register", why_en: "softer and more polite" },
        { said: "le tasse", better: "la tasse", type: "gender", why_en: "tasse is feminine" },
      ],
      kept_phrase_fr: ["l'addition, s'il vous plaît"],
    };
  });

  it("renders one card per correction", () => {
    render(<Corrections />);
    expect(screen.getAllByTestId("correction")).toHaveLength(2);
    for (const text of ["je veux le café", "je voudrais un café", "register", "softer and more polite", "le tasse", "la tasse", "gender", "tasse is feminine"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("shows nothing to fix when there are no corrections", () => {
    session.lastExchange = { transcript: [], corrections: [], kept_phrase_fr: ["un café"] };
    render(<Corrections />);
    expect(screen.getByText("nothing to fix, nice")).toBeInTheDocument();
    expect(screen.getByText("un café")).toBeInTheDocument();
  });

  it("keeps both, shows what you can now say and navigates", () => {
    render(
      <>
        <Corrections />
        <ScreenProbe />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "keep both and continue" }));
    const cards = store.all();
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => `${c.noun_fr}|${c.errorType}`)).size).toBe(3);
    expect(cards.every((c) => c.place === "café" && c.crop === session.frame)).toBe(true);
    expect(cards.find((c) => c.phrase_fr === "la tasse")).toMatchObject({ errorType: "gender", phrase_en: "tasse is feminine" });
    expect(screen.getByText("you can now say")).toBeInTheDocument();
    for (const p of ["je voudrais un café", "la tasse", "l'addition, s'il vous plaît"]) {
      expect(screen.getByText(p)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "look again" }));
    expect(screen.getByTestId("screen")).toHaveTextContent("look");
  });
});
