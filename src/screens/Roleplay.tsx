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

const EYEBROW = "font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.08em]";

function Transcript({ messages, role, dim }: { messages: Bubble[]; role: string; dim: boolean }) {
  return (
    <ol className="flex flex-1 flex-col gap-3 overflow-y-auto px-[var(--gutter)] py-4">
      {messages.map((m, i) =>
        m.role === "tutor" ? (
          <li
            key={i}
            data-role={m.role}
            className={`rise-in flex max-w-[88%] flex-col gap-2 self-start rounded-[var(--radius-card)] border border-snow/6 bg-[var(--raised)] p-5 transition-opacity duration-[var(--dur-2)] ${
              dim ? "opacity-50" : ""
            }`}
          >
            <span className={`${EYEBROW} text-[color:var(--moss-on-dark)]`}>noé · {role}</span>
            <p className="font-display text-[24px] leading-[30px]">{m.text}</p>
            {m.en && <p className="text-[15px] leading-[21px] text-[color:var(--night-text2)]">{m.en}</p>}
          </li>
        ) : (
          <li
            key={i}
            data-role={m.role}
            className="glass-dark glass-specular rise-in max-w-[80%] self-end rounded-[var(--radius-card)] px-4 py-3"
          >
            <p className="relative font-display text-[19px] leading-[25px]">{m.text}</p>
          </li>
        ),
      )}
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
      <section className="screen-enter bg-night flex min-h-dvh flex-col items-center justify-center gap-6 px-[var(--gutter)] pb-tabbar text-[color:var(--night-text)]">
        <p className="text-[16px] leading-[23px] text-[color:var(--night-text2)]">nothing to talk about yet</p>
        <button
          type="button"
          onClick={() => go("look")}
          className="press h-14 w-full rounded-[28px] bg-snow px-6 text-[17px] font-semibold text-ink"
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
    <section
      className={`bg-night relative flex min-h-dvh flex-col overflow-hidden text-[color:var(--night-text)] ${fallback ? "pb-tabbar" : "pb-[calc(env(safe-area-inset-bottom)+12px)]"}`}
    >
      {!fallback && live.state === "listening" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[300px]"
          style={{
            background: "radial-gradient(60% 50% at 50% 100%, rgba(47,163,127,0.38), rgba(47,163,127,0))",
            animation: "glowPulse 1.1s var(--ease-loop) infinite",
          }}
        />
      )}
      <header className="pt-safe sticky top-0 z-10 flex items-center gap-3 px-[var(--gutter)] pb-2">
        {!fallback && (
          <GlassButton variant="dark" aria-label="end" onClick={() => void finish(live.transcript)} className="fade-in">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </GlassButton>
        )}
        <p
          data-testid="task-pill"
          className="glass-dark glass-specular fade-in flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-[3px] rounded-[28px] px-[22px] py-2"
        >
          <span className={`relative ${EYEBROW} text-[color:var(--sun-on-dark)]`}>your task</span>
          <span className="relative text-[13px] leading-[18px]">{scene.task.fr}</span>
        </p>
      </header>

      <Transcript
        messages={fallback ? messages : live.transcript}
        role={scene.task.role}
        dim={!fallback && live.state === "listening"}
      />

      {fallback && messages.some((m) => m.local) && (
        <p
          data-testid="offline-pill"
          className="glass-dark glass-specular fade-in flex h-9 items-center self-center rounded-[18px] px-4 text-[13px] leading-[18px] text-[color:var(--night-text2)]"
        >
          offline, noé runs on this device
        </p>
      )}

      {fallback ? (
        <form
          className="relative flex flex-col gap-2 px-[var(--gutter)] py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {failed && <p className="text-[13px] leading-[18px] text-[color:var(--night-text2)]">noé did not hear that, try again</p>}
          {busy && <p className="text-[13px] leading-[18px] text-[color:var(--night-text2)]">noé is thinking</p>}
          <div className="flex gap-2">
            <input
              aria-label="your reply"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-14 min-w-0 flex-1 rounded-[28px] border border-snow/14 bg-[var(--raised)] px-5 font-display text-[19px] leading-[25px] text-[color:var(--night-text)] outline-none focus:border-[color:var(--moss-on-dark)]"
            />
            <button
              type="submit"
              disabled={busy}
              className="press h-14 rounded-[28px] bg-snow px-6 text-[17px] font-semibold text-ink disabled:opacity-50"
            >
              send
            </button>
          </div>
        </form>
      ) : (
        <div className="relative flex flex-col items-center gap-3 px-[var(--gutter)] pt-4 pb-2">
          {live.state === "listening" && live.partialUser && (
            <p className="glass-dark glass-specular rise-in max-w-full rounded-[var(--radius-card)] px-5 py-3 font-display text-[19px] leading-[25px] text-snow">
              {live.partialUser}
              <span aria-hidden className="caret relative ml-0.5 inline-block h-[19px] w-[2px] translate-y-[3px] bg-snow" />
            </p>
          )}
          <div data-state={live.state} aria-hidden>
            <Orb size={96} state={micState(live.state)} />
          </div>
          <p className={`${EYEBROW} text-[color:var(--night-text2)]`}>{status}</p>
          {live.state !== "listening" && live.state !== "speaking" && (
            <p className="text-[13px] leading-[18px] text-[color:var(--night-text2)]">Noé corrects you after, not during.</p>
          )}
        </div>
      )}
    </section>
  );
}
