import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getGradiumToken } from "../lib/api";
import { postExtract, postTranslate } from "../lib/api-listen";
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

// The tutor lines are the Live model answering; they must never show up as the English.
const conversation = [
  { kind: "user" as const, text: "On se voit demain ?", final: true },
  { kind: "tutor" as const, text: "Bien sûr, à quelle heure ?", final: true },
  { kind: "user" as const, text: "Ça marche, à midi.", final: true },
  { kind: "tutor" as const, text: "Parfait, bonne journée !", final: true },
  { kind: "user" as const, text: "Super", final: false },
];

const english: Record<string, string> = {
  "On se voit demain ?": "See you tomorrow?",
  "Ça marche, à midi.": "Works for me, at noon.",
};

async function startListening() {
  fireEvent.click(screen.getByRole("button", { name: "start listening" }));
  act(() => live.set({ state: "listening", events: conversation }));
  await screen.findByText("Works for me, at noon.");
  await screen.findByText("See you tomorrow?");
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
    vi.mocked(postTranslate).mockReset();
    vi.mocked(postTranslate).mockImplementation(async ({ text }) => ({ text: english[text] ?? `EN ${text}` }));
    vi.mocked(getGradiumToken).mockReset();
    vi.mocked(getGradiumToken).mockRejectedValue(new Error("no token"));
    act(() => go("listen"));
  });

  it("idle shows the consent card and toggles how it works", () => {
    render(<Listen />);
    expect(screen.getByRole("heading", { name: "Listen" })).toBeInTheDocument();
    expect(screen.getByText(/Only listen where people know/)).toBeInTheDocument();
    expect(screen.getByText("FR · they speak")).toBeInTheDocument();
    expect(screen.queryByText(/Stop and learn picks/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "How it works" }));
    expect(screen.getByText(/Stop and learn picks/)).toBeInTheDocument();
  });

  it("live renders pairs from events, the newest French still partial, and bookmarks toggle", async () => {
    render(<Listen />);
    await startListening();
    expect(live.start).toHaveBeenCalledWith({ mode: "listen", from: "fr", to: "en" });
    const pairs = screen.getAllByTestId("pair");
    expect(pairs).toHaveLength(3);
    expect(pairs[0].textContent).toContain("On se voit demain ?");
    expect(pairs[0].textContent).toContain("See you tomorrow?");
    expect(pairs[2].textContent).toBe("Super");
    expect(screen.queryByText(/Bien sûr|Parfait/)).not.toBeInTheDocument();
    expect(screen.getByTestId("elapsed").textContent).toBe("00:00");

    const mark = within(pairs[0]).getByRole("button", { name: /bookmark/ });
    expect(mark).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(mark);
    expect(mark).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(mark);
    expect(mark).toHaveAttribute("aria-pressed", "false");
  });

  it("pause closes the session and keeps the lines, resume reopens", async () => {
    render(<Listen />);
    await startListening();
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
    await startListening();
    fireEvent.click(within(screen.getAllByTestId("pair")[0]).getByRole("button", { name: /bookmark/ }));
    fireEvent.click(screen.getByRole("button", { name: "Stop and learn" }));
    expect(live.stop).toHaveBeenCalled();

    await screen.findByText("From that conversation");
    expect(postExtract).toHaveBeenCalledWith({
      lines: [
        { fr: "On se voit demain ?", en: "See you tomorrow?" },
        { fr: "Ça marche, à midi.", en: "Works for me, at noon." },
      ],
      level: "A1",
      knownWords: ["bonjour"],
    });
    expect(screen.getByText("1 minute · 2 lines")).toBeInTheDocument();
    await screen.findAllByTestId("keep-card");
    expect(screen.getByRole("checkbox", { name: "keep On se voit demain ?" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "keep ça marche" })).not.toBeChecked();
    expect(screen.getByText("demain")).toBeInTheDocument();
    expect(screen.queryByText("Il eût fallu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Too advanced for now/ }));
    expect(screen.getByText("Il eût fallu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "keep le midi" }));
    const keepSpy = vi.spyOn(store, "keep");
    fireEvent.click(screen.getByRole("button", { name: "Keep 2 for review" }));
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
    await startListening();
    fireEvent.click(within(screen.getAllByTestId("pair")[1]).getByRole("button", { name: /bookmark/ }));
    fireEvent.click(screen.getByRole("button", { name: "Stop and learn" }));
    await waitFor(() => expect(screen.getAllByTestId("keep-card")).toHaveLength(1));
    expect(screen.getByRole("checkbox", { name: "keep Ça marche, à midi." })).toBeChecked();
    const keepSpy = vi.spyOn(store, "keep");
    fireEvent.click(screen.getByRole("button", { name: "Save transcript to diary" }));
    expect(keepSpy).not.toHaveBeenCalled();
    keepSpy.mockRestore();
    expect(conversations.all()).toHaveLength(1);
  });

  it("translates each final French line once via /api/translate and never shows the model text", async () => {
    render(<Listen />);
    fireEvent.click(screen.getByRole("button", { name: "start listening" }));
    act(() => live.set({ state: "listening", events: [{ kind: "user", text: "On se", final: false }] }));
    act(() =>
      live.set({
        events: [
          { kind: "user", text: "On se voit demain ?", final: true },
          { kind: "tutor", text: "Bien sûr, à quelle heure ?", final: false },
        ],
      }),
    );
    act(() =>
      live.set({
        events: [
          { kind: "user", text: "On se voit demain ?", final: true },
          { kind: "tutor", text: "Bien sûr, à quelle heure ?", final: true },
        ],
      }),
    );
    await screen.findByText("See you tomorrow?");
    expect(postTranslate).toHaveBeenCalledTimes(1);
    expect(postTranslate).toHaveBeenCalledWith({ text: "On se voit demain ?", from: "fr", to: "en" });
    expect(screen.queryByText(/Bien sûr/)).not.toBeInTheDocument();
    expect(screen.queryByText("live translation unavailable, using fallback")).not.toBeInTheDocument();
  });

  it("closes the pair with no English when translate fails", async () => {
    vi.mocked(postTranslate).mockRejectedValue(new Error("translate 502"));
    vi.mocked(postExtract).mockResolvedValue({ keep: [], known: [], advanced: [] });
    render(<Listen />);
    fireEvent.click(screen.getByRole("button", { name: "start listening" }));
    act(() => live.set({ state: "listening", events: [{ kind: "user", text: "Salut", final: true }, { kind: "tutor", text: "Hi there!", final: true }] }));
    await waitFor(() => expect(postTranslate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Stop and learn" }));
    await screen.findByText("From that conversation");
    expect(postExtract).toHaveBeenCalledWith(expect.objectContaining({ lines: [{ fr: "Salut", en: "" }] }));
  });

  it("ignores a translation that arrives after stop", async () => {
    let resolve: (r: { text: string }) => void = () => {};
    vi.mocked(postTranslate).mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    vi.mocked(postExtract).mockRejectedValue(new Error("extract 502"));
    render(<Listen />);
    fireEvent.click(screen.getByRole("button", { name: "start listening" }));
    act(() => live.set({ state: "listening", events: [{ kind: "user", text: "Salut", final: false }] }));
    act(() => live.set({ events: [{ kind: "user", text: "Salut", final: true }] }));
    expect(postTranslate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Stop and learn" }));
    await screen.findByText("From that conversation");
    await act(async () => resolve({ text: "Hello (late)" }));
    expect(screen.queryByText("Hello (late)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save transcript to diary" }));
    expect(conversations.all()[0].lines.map((l) => l.en)).not.toContain("Hello (late)");
  });

  it("shows the fallback notice when the live token fails", async () => {
    render(<Listen />);
    fireEvent.click(screen.getByRole("button", { name: "start listening" }));
    act(() => live.set({ state: "error" }));
    expect(await screen.findByText("live translation unavailable, using fallback")).toBeInTheDocument();
    await waitFor(() => expect(getGradiumToken).toHaveBeenCalled());
  });
});
