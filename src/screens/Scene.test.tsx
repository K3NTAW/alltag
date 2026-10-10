import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { go, useScreen } from "../lib/screen";
import { session, resetSession } from "../lib/session";
import type { SceneResult } from "../lib/types";
import * as store from "../srs/store";
import Scene from "./Scene";

const fixture: SceneResult = {
  place: "café",
  task: { fr: "commande un café", en: "order a coffee", role: "serveur" },
  objects: [
    {
      id: "o1",
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
      id: "o2",
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

function renderScene() {
  return render(
    <>
      <ScreenProbe />
      <Scene />
    </>,
  );
}

describe("Scene", () => {
  beforeEach(() => {
    localStorage.clear();
    store.clear();
    resetSession();
    act(() => go("scene"));
    session.scene = fixture;
    session.frame = "data:image/jpeg;base64,AAAA";
  });

  it("is exactly one viewport with a full-bleed photo", () => {
    const { container } = renderScene();
    const root = container.querySelector("section")!;
    expect(root).toHaveClass("h-dvh", "overflow-hidden");
    expect(screen.getByAltText("café")).toHaveClass("h-full", "w-full", "object-cover");
  });

  it("shows the sheet with the task", () => {
    renderScene();
    expect(screen.getByText("commande un café")).toBeInTheDocument();
    expect(screen.getByText("order a coffee")).toBeInTheDocument();
  });

  it("talk goes to roleplay", () => {
    renderScene();
    fireEvent.click(screen.getByRole("button", { name: "talk" }));
    expect(screen.getByTestId("screen")).toHaveTextContent("roleplay");
  });

  it("tapping a stacked pill opens the object dialog", () => {
    renderScene();
    fireEvent.click(screen.getByRole("button", { name: "le sucre" }));
    const dialog = screen.getByRole("dialog", { name: "le sucre" });
    expect(within(dialog).getByText("with sugar")).toBeInTheDocument();
  });
});
