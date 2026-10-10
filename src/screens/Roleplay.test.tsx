import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { postCorrect, postTurn } from "../lib/api";
import { go, useScreen } from "../lib/screen";
import { session, resetSession } from "../lib/session";
import type { SceneResult, TurnMessage } from "../lib/types";
import * as store from "../srs/store";
import Roleplay from "./Roleplay";

const live = vi.hoisted(() => {
  type State = "idle" | "connecting" | "listening" | "speaking" | "done" | "error";
  const listeners = new Set<() => void>();
  let snap = {
    state: "connecting" as State,
    transcript: [] as { role: "tutor" | "learner"; text: string }[],
    partialUser: "",
  };
  return {
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    get: () => snap,
    set(patch: Partial<typeof snap>) {
      snap = { ...snap, ...patch };
      listeners.forEach((l) => l());
    },
    reset() {
      snap = { state: "connecting", transcript: [], partialUser: "" };
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
      return { ...s, start: live.start, stop: live.stop, error: undefined };
    },
  };
});

vi.mock("../lib/api", () => ({
  postTurn: vi.fn(),
  postCorrect: vi.fn(),
}));

const scene: SceneResult = {
  place: "café",
  objects: [],
  task: { fr: "commande un café", en: "order a coffee", role: "serveur" },
};

function ScreenProbe() {
  const { screen: s } = useScreen();
  return <span data-testid="screen">{s}</span>;
}

const learner = (text: string): TurnMessage => ({ role: "learner", text });
const tutor = (text: string): TurnMessage => ({ role: "tutor", text });

describe("Roleplay", () => {
  beforeEach(() => {
    localStorage.clear();
    store.clear();
    resetSession();
    live.reset();
    live.start.mockClear();
    live.stop.mockClear();
    vi.mocked(postTurn).mockReset();
    vi.mocked(postCorrect).mockReset();
    vi.mocked(postCorrect).mockImplementation(async ({ userText }) => ({
      corrections: [{ said: userText, better: `${userText}, s'il vous plaît`, type: "register", why_en: "be polite" }],
      kept_phrase_fr: "je voudrais un café",
    }));
    session.scene = scene;
    go("roleplay");
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows the empty state without a scene", () => {
    session.scene = null;
    render(<Roleplay />);
    expect(screen.getByText("nothing to talk about yet")).toBeInTheDocument();
    expect(live.start).not.toHaveBeenCalled();
  });

  it("starts live with scene, level and the recall phrase", () => {
    store.keep({ phrase_fr: "la tasse", phrase_en: "the cup", noun_fr: "tasse" });
    const card = store.keep({ phrase_fr: "le croissant chaud", phrase_en: "the warm croissant", noun_fr: "croissant" });
    session.recallCardId = card.id;
    render(<Roleplay />);
    expect(screen.getByTestId("task-pill")).toHaveTextContent("commande un café");
    expect(live.start).toHaveBeenCalledWith({
      scene,
      level: "A1",
      knownWords: ["tasse", "croissant"],
      recallPhrase: "le croissant chaud",
    });
    expect(session.recallCardId).toBeNull();
  });

  it("renders learner and tutor bubbles from the transcript", () => {
    render(<Roleplay />);
    act(() => live.set({ state: "listening", partialUser: "je veu", transcript: [tutor("bonjour !")] }));
    expect(screen.getByText("je veu")).toBeInTheDocument();
    act(() => live.set({ state: "speaking", transcript: [tutor("bonjour !"), learner("je veux le café"), tutor("très bien")] }));
    expect(screen.getByText("je veux le café").closest("li")).toHaveAttribute("data-role", "learner");
    expect(screen.getByText("très bien").closest("li")).toHaveAttribute("data-role", "tutor");
    expect(screen.getByText("noé is speaking, just talk to interrupt")).toBeInTheDocument();
  });

  it("on done corrects every learner line and goes to corrections", async () => {
    render(
      <>
        <Roleplay />
        <ScreenProbe />
      </>,
    );
    const transcript = [tutor("bonjour"), learner("je veux le café"), tutor("et avec ça ?"), learner("un croissant")];
    act(() => live.set({ state: "done", transcript }));
    await waitFor(() => expect(screen.getByTestId("screen")).toHaveTextContent("corrections"));
    expect(live.stop).toHaveBeenCalled();
    expect(postCorrect).toHaveBeenCalledTimes(2);
    expect(postCorrect).toHaveBeenCalledWith({ scene, userText: "je veux le café", level: "A1" });
    expect(postCorrect).toHaveBeenCalledWith({ scene, userText: "un croissant", level: "A1" });
    expect(session.lastExchange).toEqual({
      transcript,
      corrections: [
        { said: "je veux le café", better: "je veux le café, s'il vous plaît", type: "register", why_en: "be polite" },
        { said: "un croissant", better: "un croissant, s'il vous plaît", type: "register", why_en: "be polite" },
      ],
      kept_phrase_fr: ["je voudrais un café"],
    });
  });

  it("finishes after 4 learner turns", async () => {
    render(
      <>
        <Roleplay />
        <ScreenProbe />
      </>,
    );
    const transcript = [1, 2, 3, 4].flatMap((n) => [tutor(`t${n}`), learner(`l${n}`)]);
    act(() => live.set({ state: "listening", transcript }));
    await waitFor(() => expect(screen.getByTestId("screen")).toHaveTextContent("corrections"));
    expect(postCorrect).toHaveBeenCalledTimes(4);
    expect(session.lastExchange?.corrections).toHaveLength(4);
    expect(session.lastExchange?.transcript).toEqual(transcript);
  });

  it("falls back to text on error and calls postTurn", async () => {
    vi.mocked(postTurn).mockResolvedValue({ reply_fr: "un café, très bien", reply_en: "a coffee, very good", task_done: false });
    render(<Roleplay />);
    act(() => live.set({ state: "error" }));
    fireEvent.change(screen.getByLabelText("your reply"), { target: { value: "je veux le café" } });
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    expect(await screen.findByText("un café, très bien")).toBeInTheDocument();
    expect(screen.getByText("a coffee, very good")).toBeInTheDocument();
    expect(screen.getByText("je veux le café").closest("li")).toHaveAttribute("data-role", "learner");
    expect(postTurn).toHaveBeenCalledWith({
      scene,
      history: [tutor("commande un café")],
      userText: "je veux le café",
      level: "A1",
    });
  });

  it("text fallback goes to corrections when the task is done", async () => {
    vi.mocked(postTurn).mockResolvedValue({ reply_fr: "voilà", reply_en: "here you go", task_done: true });
    render(
      <>
        <Roleplay />
        <ScreenProbe />
      </>,
    );
    act(() => live.set({ state: "error" }));
    fireEvent.change(screen.getByLabelText("your reply"), { target: { value: "je veux le café" } });
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(screen.getByTestId("screen")).toHaveTextContent("corrections"));
    expect(postCorrect).toHaveBeenCalledWith({ scene, userText: "je veux le café", level: "A1" });
    expect(session.lastExchange?.corrections).toHaveLength(1);
  });

  it("offline: skips live, Enter sends the typed reply, shows the on-device pill", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.mocked(postTurn).mockResolvedValue({
      reply_fr: "d'accord",
      reply_en: "ok",
      task_done: false,
      source: "local",
    });
    render(<Roleplay />);
    expect(live.start).not.toHaveBeenCalled();
    expect(screen.queryByTestId("offline-pill")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("your reply"), "je veux le café{Enter}");
    expect(await screen.findByText("d'accord")).toBeInTheDocument();
    expect(postTurn).toHaveBeenCalledWith({
      scene,
      history: [tutor("commande un café")],
      userText: "je veux le café",
      level: "A1",
    });
    expect(screen.getByTestId("offline-pill")).toHaveTextContent("offline, noé runs on this device");
  });

  it("no offline pill for cloud replies", async () => {
    vi.mocked(postTurn).mockResolvedValue({ reply_fr: "voilà", reply_en: "here", task_done: false });
    render(<Roleplay />);
    act(() => live.set({ state: "error" }));
    await userEvent.type(screen.getByLabelText("your reply"), "un café{Enter}");
    expect(await screen.findByText("voilà")).toBeInTheDocument();
    expect(screen.queryByTestId("offline-pill")).not.toBeInTheDocument();
  });
});
