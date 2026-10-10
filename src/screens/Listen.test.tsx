import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getGradiumToken } from "../lib/api";
import { postExtract } from "../lib/api-listen";
import { go, useScreen } from "../lib/screen";
import * as conversations from "../srs/conversations";
import * as store from "../srs/store";
import Listen from "./Listen";

const live = vi.hoisted(() => {
  type State = "idle" | "connecting" | "listening" | "speaking" | "done" | "error";
  type Ev = { kind: "user" | "tutor"; text: string; final: boolean };
  const listeners = new Set<() => void>();
  let snap = { state: "idle" as State, events: [] as Ev[] };
  return {
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    get: () => snap,
    set(patch: Partial<typeof snap>) {
      snap = { ...snap, ...patch };
      listeners.forEach((l) => l());
    },
    reset() {
      snap = { state: "idle", events: [] };
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
});

vi.mock("../voice/useLive", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useLive: () => {
      const s = useSyncExternalStore(live.subscribe, live.get, live.get);
      return { ...s, transcript: [], partialUser: "", start: live.start, stop: live.stop, error: undefined };
    },
  };
});

vi.mock("../lib/api-listen", () => ({ postExtract: vi.fn(), postTranslate: vi.fn() }));
vi.mock("../lib/api", () => ({ getGradiumToken: vi.fn() }));

function ScreenProbe() {
  return <output data-testid="screen">{useScreen().screen}</output>;
}

const conversation = [
  { kind: "user" as const, text: "On se voit demain ?", final: true },
  { kind: "tutor" as const, text: "See you tomorrow?", final: true },
  { kind: "user" as const, text: "Ça marche, à midi.", final: true },
  { kind: "tutor" as const, text: "Works for me, at noon.", final: true },
  { kind: "user" as const, text: "Super", final: false },
];

function startListening() {
  fireEvent.click(screen.getByRole("button", { name: "start listening" }));
  act(() => live.set({ state: "listening", events: conversation }));
}

describe("Listen", () => {
  beforeEach(() => {
    localStorage.clear();
    store.clear();
    conversations.clear();
    live.reset();
    live.start.mockClear();
    live.stop.mockClear();
    vi.mocked(postExtract).mockReset();
    vi.mocked(getGradiumToken).mockReset();
    vi.mocked(getGradiumToken).mockRejectedValue(new Error("no token"));
    act(() => go("listen"));
  });

  it("idle shows the consent card and toggles how it works", () => {
    render(<Listen />);
    expect(screen.getByRole("heading", { name: "listen" })).toBeInTheDocument();
    expect(screen.getByText(/only listen where people know/)).toBeInTheDocument();
    expect(screen.getByText("fr -> en")).toBeInTheDocument();
    expect(screen.queryByText(/stop and learn picks/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "how it works" }));
    expect(screen.getByText(/stop and learn picks/)).toBeInTheDocument();
  });

  it("live renders pairs from events, the newest French still partial, and bookmarks toggle", () => {
    render(<Listen />);
    startListening();
    expect(live.start).toHaveBeenCalledWith({ mode: "listen", from: "fr", to: "en" });
    const pairs = screen.getAllByTestId("pair");
    expect(pairs).toHaveLength(3);
    expect(pairs[0].textContent).toContain("On se voit demain ?");
    expect(pairs[0].textContent).toContain("See you tomorrow?");
    expect(pairs[2].textContent).toBe("Super");
    expect(screen.getByTestId("elapsed").textContent).toBe("00:00");

    const mark = within(pairs[0]).getByRole("button", { name: /bookmark/ });
    expect(mark).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(mark);
    expect(mark).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(mark);
    expect(mark).toHaveAttribute("aria-pressed", "false");
  });

  it("pause closes the session and keeps the lines, resume reopens", () => {
    render(<Listen />);
    startListening();
    fireEvent.click(screen.getByRole("button", { name: "pause" }));
    expect(live.stop).toHaveBeenCalled();
    expect(screen.getAllByTestId("pair")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    expect(live.start).toHaveBeenCalledTimes(2);
    act(() => live.set({ events: [{ kind: "user", text: "Encore une chose", final: true }] }));
    expect(screen.getAllByTestId("pair")).toHaveLength(4);
  });

  it("stop and learn shows extract results with bookmarked lines pre-checked, keep stores cards and opens the diary", async () => {
    store.keep({ phrase_fr: "bonjour", phrase_en: "hello" });
    vi.mocked(postExtract).mockResolvedValue({
      keep: [
        { fr: "ça marche", en: "works for me", why: "an everyday yes", type: "expression" },
        { fr: "On se voit demain ?", en: "See you tomorrow?", why: "for plans", type: "phrase" },
        { fr: "le midi", en: "noon", why: "time", type: "word", noun_fr: "midi" },
      ],
      known: ["demain"],
      advanced: [{ fr: "Il eût fallu", en: "It would have been necessary" }],
    });
    render(
      <>
        <Listen />
        <ScreenProbe />
      </>,
    );
    startListening();
    fireEvent.click(within(screen.getAllByTestId("pair")[0]).getByRole("button", { name: /bookmark/ }));
    fireEvent.click(screen.getByRole("button", { name: "stop and learn" }));
    expect(live.stop).toHaveBeenCalled();

    await screen.findByText("from that conversation");
    expect(postExtract).toHaveBeenCalledWith({
      lines: [
        { fr: "On se voit demain ?", en: "See you tomorrow?" },
        { fr: "Ça marche, à midi.", en: "Works for me, at noon." },
      ],
      level: "A1",
      knownWords: ["bonjour"],
    });
    expect(screen.getByText("1 minute, 2 lines")).toBeInTheDocument();
    await screen.findAllByTestId("keep-card");
    expect(screen.getByRole("checkbox", { name: "keep On se voit demain ?" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "keep ça marche" })).not.toBeChecked();
    expect(screen.getByText("demain")).toBeInTheDocument();
    expect(screen.queryByText("Il eût fallu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /too advanced for now/ }));
    expect(screen.getByText("Il eût fallu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "keep le midi" }));
    const keepSpy = vi.spyOn(store, "keep");
    fireEvent.click(screen.getByRole("button", { name: "keep 2 and add to review" }));
    expect(keepSpy).toHaveBeenCalledTimes(2);
    expect(keepSpy).toHaveBeenCalledWith({
      phrase_fr: "On se voit demain ?",
      phrase_en: "See you tomorrow?",
      errorType: "phrase",
      noun_fr: undefined,
    });
    expect(keepSpy).toHaveBeenCalledWith({ phrase_fr: "le midi", phrase_en: "noon", errorType: "phrase", noun_fr: "midi" });
    keepSpy.mockRestore();
    expect(screen.getByTestId("screen").textContent).toBe("diary");
    const saved = conversations.all();
    expect(saved).toHaveLength(1);
    expect(saved[0].lines).toHaveLength(2);
    expect(saved[0].keptCount).toBe(1);
  });

  it("shows only the bookmarked lines when extract fails, and save transcript keeps nothing", async () => {
    vi.mocked(postExtract).mockRejectedValue(new Error("extract 502"));
    render(<Listen />);
    startListening();
    fireEvent.click(within(screen.getAllByTestId("pair")[1]).getByRole("button", { name: /bookmark/ }));
    fireEvent.click(screen.getByRole("button", { name: "stop and learn" }));
    await waitFor(() => expect(screen.getAllByTestId("keep-card")).toHaveLength(1));
    expect(screen.getByRole("checkbox", { name: "keep Ça marche, à midi." })).toBeChecked();
    const keepSpy = vi.spyOn(store, "keep");
    fireEvent.click(screen.getByRole("button", { name: "save transcript to diary" }));
    expect(keepSpy).not.toHaveBeenCalled();
    keepSpy.mockRestore();
    expect(conversations.all()).toHaveLength(1);
  });

  it("shows the fallback notice when the live token fails", async () => {
    render(<Listen />);
    fireEvent.click(screen.getByRole("button", { name: "start listening" }));
    act(() => live.set({ state: "error" }));
    expect(await screen.findByText("live translation unavailable, using fallback")).toBeInTheDocument();
    await waitFor(() => expect(getGradiumToken).toHaveBeenCalled());
  });
});
