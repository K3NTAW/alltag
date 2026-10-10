import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { go, useScreen } from "../lib/screen";
import { session, resetSession } from "../lib/session";
import type { SceneResult } from "../lib/types";
import * as store from "../srs/store";
import Look from "./Look";
import Scene from "./Scene";

vi.mock("../lib/api", () => ({
  postScene: vi.fn(),
}));

const fixture: SceneResult = {
  place: "café",
  task: { fr: "commande un café", en: "order a coffee", role: "serveur" },
  objects: [
    {
      id: "o1",
      fr: "la machine à café",
      en: "the coffee machine",
      article: "la",
      gender: "f",
      plural: "les machines à café",
      level: "A1",
      phrase_fr: "la machine à café est chaude",
      phrase_en: "the coffee machine is hot",
      bbox: [0.1, 0.1, 0.2, 0.2],
    },
    {
      id: "o2",
      fr: "la tasse",
      en: "the cup",
      article: "la",
      gender: "f",
      plural: "les tasses",
      level: "A1",
      phrase_fr: "une tasse, s'il vous plaît",
      phrase_en: "a cup, please",
      bbox: [0.5, 0.5, 0.1, 0.1],
    },
    {
      id: "o3",
      fr: "le sucre",
      en: "the sugar",
      article: "le",
      gender: "m",
      plural: "les sucres",
      level: "A1",
      phrase_fr: "avec du sucre",
      phrase_en: "with sugar",
    },
  ],
};

function ScreenProbe() {
  return <output data-testid="screen">{useScreen().screen}</output>;
}

describe("Look", () => {
  it("renders the file fallback when getUserMedia rejects", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const { container } = render(<Look />);
    await waitFor(() => {
      expect(container.querySelector('input[type="file"]')).not.toBeNull();
    });
    const input = container.querySelector('input[type="file"]')!;
    expect(input.getAttribute("accept")).toBe("image/*");
    expect(input.getAttribute("capture")).toBe("environment");
    expect(screen.getByText("point at anything")).toBeInTheDocument();
  });
});

describe("Scene", () => {
  beforeEach(() => {
    localStorage.clear();
    store.clear();
    resetSession();
    act(() => go("scene"));
    session.scene = fixture;
    session.frame = "data:image/jpeg;base64,AAAA";
  });

  it("renders pills, opens the sheet, keeps a card and talks", () => {
    render(
      <>
        <ScreenProbe />
        <Scene />
      </>,
    );
    for (const o of fixture.objects) {
      expect(screen.getByRole("button", { name: o.fr })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "la machine à café" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("la machine à café")).toBeInTheDocument();
    expect(within(sheet).getByText("la machine à café est chaude")).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "keep" }));
    expect(store.all()).toHaveLength(1);
    expect(store.all()[0].noun_fr).toBe("la machine à café");
    expect(screen.getByRole("button", { name: "la machine à café" })).toHaveAttribute("data-state", "known");

    fireEvent.click(within(sheet).getByRole("button", { name: "talk" }));
    expect(screen.getByTestId("screen")).toHaveTextContent("roleplay");
  });

  it("shows an empty state without a scene", () => {
    session.scene = null;
    render(<Scene />);
    expect(screen.getByText("nothing seen yet")).toBeInTheDocument();
  });
});
