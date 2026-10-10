import { fireEvent, render, screen } from "@testing-library/react";
import * as store from "../srs/store";
import Review from "./Review";

vi.mock("../voice/useVoice", () => ({
  useVoice: () => ({
    state: "idle",
    partial: "",
    startListening: vi.fn(),
    stopListening: vi.fn(),
    speak: vi.fn(),
    stop: vi.fn(),
    setState: vi.fn(),
  }),
}));

vi.mock("../lib/api", () => ({
  postCheck: vi.fn().mockRejectedValue(new Error("offline")),
}));

const DAY = 24 * 60 * 60 * 1000;

describe("Review", () => {
  beforeEach(() => {
    localStorage.clear();
    store.clear();
  });

  it("walks the due queue and returns to the empty state", async () => {
    const a = store.keep({
      phrase_fr: "la machine à café",
      phrase_en: "the coffee machine",
      noun_fr: "machine à café",
      place: "café",
      errorType: "article",
    });
    const b = store.keep({
      phrase_fr: "une tasse, s'il vous plaît",
      phrase_en: "a cup, please",
      noun_fr: "tasse",
      place: "café",
      errorType: "gender",
    });
    const future = store.keep({ phrase_fr: "le sucre", phrase_en: "the sugar", noun_fr: "sucre" });
    store.grade(future.id, 5, Date.now());
    store.grade(a.id, 0, Date.now() - 2 * DAY);
    store.grade(b.id, 0, Date.now() - DAY - 1000);
    // reset reps after the setup grades so the first pass is reps 1
    const cards = store.all().map((c) => (c.id === future.id ? c : { ...c, reps: 0 }));
    localStorage.setItem("alltag.cards", JSON.stringify(cards));

    render(<Review />);
    expect(screen.getByText("due now")).toBeInTheDocument();
    expect(screen.getByTestId("due-count")).toHaveTextContent("2");
    expect(document.querySelector('[data-group="article"]')).not.toBeNull();
    expect(screen.getByText("you keep dropping the article on feminine nouns")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    expect(screen.getByText("say it: the coffee machine")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("or type it"), { target: { value: "la machine à café" } });
    fireEvent.click(screen.getByRole("button", { name: "check" }));
    expect(await screen.findByText(/next in 1 day$/)).toBeInTheDocument();
    const graded = store.get(a.id)!;
    expect(graded.reps).toBe(1);
    expect(graded.interval).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByText("say it: a cup, please")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("or type it"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "check" }));
    expect(await screen.findByText("not yet, again tomorrow")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByText("nothing due, go look at something")).toBeInTheDocument();
  });
});
