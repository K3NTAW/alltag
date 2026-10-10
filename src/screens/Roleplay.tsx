import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { postCorrect, postTurn } from "../lib/api";
import { go } from "../lib/screen";
import { session } from "../lib/session";
import { getSettings } from "../lib/settings";
import type { Card, Correction, SceneResult, TurnMessage } from "../lib/types";
import * as store from "../srs/store";
import { useLive } from "../voice/useLive";
import GlassButton, { type MicState } from "../components/GlassButton";
import Orb from "../components/Orb";
import { useFullScreen } from "../components/TabBar";

const MAX_LEARNER_TURNS = 4;

interface Bubble extends TurnMessage {
  en?: string;
  local?: boolean;
}

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function useOffline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => !navigator.onLine);
}

function openingLine(scene: SceneResult, card: Card | undefined): string {
  return card ? `on a vu ça la dernière fois. ${card.phrase_fr} — ${scene.task.fr}` : scene.task.fr;
}

function learnerCount(messages: TurnMessage[]): number {
  return messages.filter((m) => m.role === "learner").length;
}

function micState(state: string): MicState {
  if (state === "listening" || state === "speaking") return state;
  return state === "done" ? "thinking" : "idle";
}

function Transcript({ messages }: { messages: Bubble[] }) {
  return (
    <ol className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((m, i) => (
        <li
          key={i}
          data-role={m.role}
          className={`max-w-[80%] rounded-[var(--radius-m)] px-4 py-2 ${
            m.role === "tutor" ? "self-start bg-card text-ink shadow" : "self-end bg-accent text-card"
          }`}
        >
          <p>{m.text}</p>
          {m.en && <p className="text-[length:var(--text-s)] text-muted">{m.en}</p>}
        </li>
      ))}
    </ol>
  );
}

export default function Roleplay() {
  const scene = session.scene;
  const [level] = useState(() => getSettings().level);
  const [card] = useState(() => (session.recallCardId ? store.get(session.recallCardId) : undefined));
  const live = useLive();
  const { start, stop } = live;
  const [startFailed, setStartFailed] = useState(false);
  const offline = useOffline();
  // Live needs the network; offline the typed path runs on the on-device model.
  const fallback = startFailed || live.state === "error" || offline;
  const [messages, setMessages] = useState<Bubble[]>(() =>
    scene ? [{ role: "tutor", text: openingLine(scene, card) }] : [],
  );
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const finishing = useRef(false);
  // The voice conversation is full screen; idle and the typed fallback keep the tab bar.
  useFullScreen(!!scene && !fallback);

  useEffect(() => {
    if (!scene) return;
    session.recallCardId = null;
    if (offline) return;
    start({
      scene,
      level,
      knownWords: store.all().map((c) => c.noun_fr ?? c.phrase_fr),
      recallPhrase: card?.phrase_fr,
    }).catch(() => setStartFailed(true));
  }, [scene, level, card, start, offline]);

  const finish = useCallback(
    async (transcript: TurnMessage[]) => {
      if (finishing.current || !scene) return;
      finishing.current = true;
      stop();
      const results = await Promise.all(
        transcript
          .filter((m) => m.role === "learner")
          .map((m) => postCorrect({ scene, userText: m.text, level }).catch(() => null)),
      );
      const corrections: Correction[] = [];
      const seen = new Set<string>();
      const kept: string[] = [];
      for (const r of results) {
        if (!r) continue;
        for (const c of r.corrections) {
          const key = `${c.said}\u0000${c.better}`;
          if (seen.has(key)) continue;
          seen.add(key);
          corrections.push(c);
        }
        if (r.kept_phrase_fr && !kept.includes(r.kept_phrase_fr)) kept.push(r.kept_phrase_fr);
      }
      session.lastExchange = { transcript, corrections, kept_phrase_fr: kept };
      go("corrections");
    },
    [scene, level, stop],
  );

  useEffect(() => {
    if (fallback) return;
    if (live.state === "done" || learnerCount(live.transcript) >= MAX_LEARNER_TURNS) {
      void finish(live.transcript);
    }
  }, [fallback, live.state, live.transcript, finish]);

  if (!scene) {
    return (
      <section className="bg-night flex min-h-dvh flex-col items-center justify-center gap-4 p-6 pb-tabbar text-snow">
        <p className="text-snow/72">nothing to talk about yet</p>
        <button
          type="button"
          onClick={() => go("look")}
          className="rounded-[26px] bg-accent px-6 py-3 text-[length:var(--text-m)] font-semibold text-card"
        >
          look
        </button>
      </section>
    );
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy || !scene) return;
    const history: TurnMessage[] = messages.map(({ role, text }) => ({ role, text }));
    const withLearner: Bubble[] = [...messages, { role: "learner", text }];
    setMessages(withLearner);
    setDraft("");
    setBusy(true);
    setFailed(false);
    try {
      const reply = await postTurn({ scene, history, userText: text, level });
      const next: Bubble[] = [...withLearner, { role: "tutor", text: reply.reply_fr, en: reply.reply_en, local: reply.source === "local" }];
      setMessages(next);
      if (reply.task_done || learnerCount(next) >= MAX_LEARNER_TURNS) {
        await finish(next.map(({ role, text }) => ({ role, text })));
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const status =
    live.state === "speaking"
      ? "noé is speaking, just talk to interrupt"
      : live.state === "listening"
        ? "listening"
        : live.state === "done"
          ? "noé is thinking"
          : "connecting";

  return (
    <section className={`bg-night flex min-h-dvh flex-col text-snow ${fallback ? "pb-tabbar" : "pb-[env(safe-area-inset-bottom)]"}`}>
      <header className="pt-safe sticky top-0 z-10 flex items-center justify-between gap-3 px-4 pb-2">
        <p
          data-testid="task-pill"
          className="glass-dark glass-specular flex h-9 items-center rounded-[18px] px-4 text-[15px] font-semibold"
        >
          {scene.task.fr}
        </p>
        {!fallback && (
          <GlassButton variant="dark" aria-label="end" onClick={() => void finish(live.transcript)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </GlassButton>
        )}
      </header>

      <Transcript messages={fallback ? messages : live.transcript} />

      {fallback && messages.some((m) => m.local) && (
        <p
          data-testid="offline-pill"
          className="glass-dark glass-specular flex h-9 items-center self-center rounded-[18px] px-4 text-[length:var(--text-s)] text-snow/72"
        >
          offline, noé runs on this device
        </p>
      )}

      {fallback ? (
        <form
          className="flex flex-col gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {failed && <p className="text-[length:var(--text-s)] text-snow/72">noé did not hear that, try again</p>}
          {busy && <p className="text-[length:var(--text-s)] text-snow/72">noé is thinking</p>}
          <div className="flex gap-2">
            <input
              aria-label="your reply"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 rounded-[var(--radius-pill)] border border-line bg-card px-4 py-2 text-ink"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-[var(--radius-pill)] bg-accent px-5 py-2 text-card"
            >
              send
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-3 p-6">
          {live.state === "listening" && live.partialUser && (
            <p className="text-snow/72">{live.partialUser}</p>
          )}
          <div data-state={live.state} aria-hidden>
            <Orb size={96} state={micState(live.state)} />
          </div>
          <p className="text-[length:var(--text-s)] text-snow/72">{status}</p>
        </div>
      )}
    </section>
  );
}
