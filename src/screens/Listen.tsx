import { useCallback, useEffect, useRef, useState } from "react";
import { getGradiumToken } from "../lib/api";
import { postExtract, postTranslate } from "../lib/api-listen";
import { go } from "../lib/screen";
import { getSettings } from "../lib/settings";
import type { ExtractType } from "../lib/types";
import { pairLines, type Pair } from "../listen/pairs";
import * as conversations from "../srs/conversations";
import * as store from "../srs/store";
import { defaultStartMic } from "../voice/live";
import { SttSession } from "../voice/stt";
import { useLive } from "../voice/useLive";
import { MicFace } from "../components/GlassButton";
import { useFullScreen } from "../components/TabBar";

type Phase = "idle" | "live" | "learn";

interface LearnItem {
  id: string;
  fr: string;
  en: string;
  why: string;
  type: ExtractType;
  noun_fr?: string;
  checked: boolean;
}

interface LearnState {
  loading: boolean;
  items: LearnItem[];
  known: string[];
  advanced: { fr: string; en: string }[];
  lines: Pair[];
}

const HOW = [
  "gemini hears the room and writes each french line as it is said.",
  "every line gets its english right under it. bookmark the ones you like.",
  "stop and learn picks what is worth keeping at your level.",
];

function clock(s: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

const norm = (s: string) => s.trim().toLowerCase();

function covers(line: string, item: string): boolean {
  const a = norm(line);
  const b = norm(item);
  return !!a && !!b && (a.includes(b) || b.includes(a));
}

/** Bookmarked lines pre-check matching items; bookmarked lines no item covers are added checked. */
function buildItems(
  keep: { fr: string; en: string; why: string; type: ExtractType; noun_fr?: string }[],
  bookmarked: Pair[],
): LearnItem[] {
  const items: LearnItem[] = keep.map((k, i) => ({
    ...k,
    id: `k${i}`,
    checked: bookmarked.some((p) => covers(p.fr, k.fr)),
  }));
  for (const p of bookmarked) {
    if (items.some((it) => covers(p.fr, it.fr))) continue;
    items.push({ id: p.id, fr: p.fr, en: p.en, why: "you bookmarked this", type: "phrase", checked: true });
  }
  return items;
}

// Same round control as the roleplay mic.
function MicButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded-[var(--radius-pill)]">
      <MicFace state="idle" surface="light" />
    </button>
  );
}

export default function Listen() {
  const live = useLive();
  const { start, stop } = live;
  const [phase, setPhase] = useState<Phase>("idle");
  const [howOpen, setHowOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  // Pairs from earlier sessions (before a pause) and every fallback pair.
  const [committed, setCommitted] = useState<Pair[]>([]);
  const [segment, setSegment] = useState(0);
  const [keptIds, setKeptIds] = useState<Set<string>>(() => new Set());
  const [elapsed, setElapsed] = useState(0);
  const [learn, setLearn] = useState<LearnState | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const startedAt = useRef("");
  const convId = useRef<string | undefined>(undefined);
  const fb = useRef<{
    stt?: SttSession;
    stopMic?: () => void;
    openId?: string;
    active: boolean;
    n: number;
    gen: number;
  }>({ active: false, n: 0, gen: 0 });
  useFullScreen(phase === "live");

  // Token or connect failure -> Gradium STT + /api/translate for the rest of this conversation.
  if (phase === "live" && !paused && !fallback && live.state === "error") setFallback(true);

  const livePairs = fallback || paused || phase !== "live" ? [] : pairLines(live.events, `s${segment}-`);
  const pairs = [...committed, ...livePairs].map((p) => ({ ...p, kept: keptIds.has(p.id) }));

  const closeFallback = useCallback(() => {
    const f = fb.current;
    f.gen += 1;
    f.active = false;
    f.stopMic?.();
    f.stopMic = undefined;
    f.stt?.close();
    f.stt = undefined;
    f.openId = undefined;
  }, []);

  const startFallback = useCallback(async () => {
    const f = fb.current;
    const gen = ++f.gen;
    f.active = true;
    const setPair = (id: string, patch: Partial<Pair>) =>
      setCommitted((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const upsert = (text: string): string => {
      if (f.openId) {
        setPair(f.openId, { fr: text });
        return f.openId;
      }
      const id = `f${f.n++}`;
      f.openId = id;
      setCommitted((list) => [...list, { id, fr: text, en: "", final: false, kept: false }]);
      return id;
    };
    try {
      const { token } = await getGradiumToken();
      if (gen !== f.gen) return;
      const stt = new SttSession({
        token,
        language: "fr",
        onPartial: (text) => {
          if (gen === f.gen) upsert(text);
        },
        onFinal: (text) => {
          if (gen !== f.gen) return;
          const id = upsert(text);
          f.openId = undefined;
          postTranslate({ text, from: "fr", to: "en" })
            .then((r) => setPair(id, { en: r.text, final: true }))
            .catch(() => setPair(id, { final: true }));
        },
      });
      // One socket for the whole conversation; turns end on VAD.
      stt.open();
      f.stt = stt;
      const stopMic = await defaultStartMic((samples, rate) => stt.pushSamples(samples, rate));
      if (gen !== f.gen) stopMic();
      else f.stopMic = stopMic;
    } catch {
      if (gen === f.gen) setFallbackError(true);
    }
  }, []);

  useEffect(() => {
    if (fallback && phase === "live" && !paused && !fb.current.active) void startFallback();
  }, [fallback, phase, paused, startFallback]);

  useEffect(() => {
    if (phase !== "live" || paused) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase, paused]);

  useEffect(() => closeFallback, [closeFallback]);

  function openSession() {
    // In fallback the effect above reopens the STT socket.
    if (fallback) return;
    start({ mode: "listen", from: "fr", to: "en" }).catch(() => setFallback(true));
  }

  function begin() {
    startedAt.current = new Date().toISOString();
    convId.current = undefined;
    setCommitted([]);
    setKeptIds(new Set());
    setElapsed(0);
    setPaused(false);
    setFallbackError(false);
    setLearn(null);
    setPhase("live");
    openSession();
  }

  function closeSession() {
    if (fallback) {
      closeFallback();
    } else {
      stop();
      setCommitted((c) => [...c, ...livePairs]);
      setSegment((s) => s + 1);
    }
  }

  function pause() {
    closeSession();
    setPaused(true);
  }

  function resume() {
    setPaused(false);
    openSession();
  }

  function toggleKept(id: string) {
    setKeptIds((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function stopAndLearn() {
    if (!paused) closeSession();
    setPaused(false);
    const lines = pairs.filter((p) => p.final || p.kept);
    const bookmarked = lines.filter((p) => p.kept);
    setPhase("learn");
    setLearn({ loading: true, items: [], known: [], advanced: [], lines });
    const finals = lines.filter((p) => p.final && p.fr);
    try {
      if (!finals.length) throw new Error("nothing heard");
      const res = await postExtract({
        lines: finals.map(({ fr, en }) => ({ fr, en })),
        level: getSettings().level,
        knownWords: store.all().map((c) => c.phrase_fr),
      });
      setLearn({ loading: false, items: buildItems(res.keep, bookmarked), known: res.known, advanced: res.advanced, lines });
    } catch {
      setLearn({ loading: false, items: buildItems([], bookmarked), known: [], advanced: [], lines });
    }
  }

  function saveConversation(state: LearnState, keptItems: LearnItem[]) {
    const conv = conversations.save({
      id: convId.current,
      startedAt: startedAt.current || new Date().toISOString(),
      durationS: elapsed,
      lines: state.lines.map((p) => ({
        fr: p.fr,
        en: p.en,
        kept: p.kept || keptItems.some((it) => covers(p.fr, it.fr)),
      })),
    });
    convId.current = conv.id;
  }

  function keepAndReview() {
    if (!learn) return;
    const chosen = learn.items.filter((it) => it.checked);
    for (const it of chosen) {
      store.keep({ phrase_fr: it.fr, phrase_en: it.en, errorType: "phrase", noun_fr: it.noun_fr });
    }
    saveConversation(learn, chosen);
    go("diary");
  }

  function saveTranscript() {
    if (!learn) return;
    saveConversation(learn, []);
    go("diary");
  }

  if (phase === "learn" && learn) {
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const k = learn.items.filter((it) => it.checked).length;
    return (
      <section className="pt-safe pb-tabbar flex flex-col gap-5 px-[var(--gutter)]">
        <header>
          <h1 className="font-display text-[length:var(--text-h1)] leading-[var(--lh-h1)] font-bold">from that conversation</h1>
          <p className="text-muted">
            {minutes} {minutes === 1 ? "minute" : "minutes"}, {learn.lines.length} {learn.lines.length === 1 ? "line" : "lines"}
          </p>
        </header>
        {learn.loading ? (
          <p className="text-muted">picking what is worth keeping</p>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <h2 className="text-[length:var(--text-title)] leading-[var(--lh-title)]">worth keeping</h2>
              {learn.items.length === 0 && <p className="text-muted">nothing picked this time</p>}
              {learn.items.map((it) => (
                <article
                  key={it.id}
                  data-testid="keep-card"
                  className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4"
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="font-display text-[length:var(--text-title)]">{it.fr}</p>
                    <p className="text-muted">{it.en}</p>
                    {it.why && <p className="text-[length:var(--text-small)] text-muted">{it.why}</p>}
                    <span className="self-start rounded-[var(--radius-pill)] bg-accent-soft px-3 py-0.5 text-[length:var(--text-micro)] text-accent">
                      {it.type}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    aria-label={`keep ${it.fr}`}
                    checked={it.checked}
                    onChange={() =>
                      setLearn((l) =>
                        l && { ...l, items: l.items.map((x) => (x.id === it.id ? { ...x, checked: !x.checked } : x)) },
                      )
                    }
                    className="mt-1 h-5 w-5 accent-[var(--moss)]"
                  />
                </article>
              ))}
            </section>
            {learn.known.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-[length:var(--text-title)] leading-[var(--lh-title)]">you already know</h2>
                <ul className="flex flex-wrap gap-2">
                  {learn.known.map((w) => (
                    <li key={w} className="rounded-[var(--radius-chip)] border border-line bg-card px-3 py-1 text-[length:var(--text-small)]">
                      {w}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {learn.advanced.length > 0 && (
              <section className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((o) => !o)}
                  aria-expanded={advancedOpen}
                  className="flex justify-between rounded-[var(--radius-card)] border border-line bg-card px-4 py-3 text-left"
                >
                  <span>too advanced for now</span>
                  <span className="text-muted">{learn.advanced.length}</span>
                </button>
                {advancedOpen && (
                  <ul className="flex flex-col gap-2 px-4">
                    {learn.advanced.map((a) => (
                      <li key={a.fr}>
                        <p>{a.fr}</p>
                        <p className="text-[length:var(--text-small)] text-muted">{a.en}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={learn.loading}
            onClick={keepAndReview}
            className="h-[52px] rounded-[26px] bg-accent px-5 text-[length:var(--text-m)] font-semibold text-card"
          >
            keep {k} and add to review
          </button>
          <button
            type="button"
            disabled={learn.loading}
            onClick={saveTranscript}
            className="h-[52px] rounded-[26px] border border-line bg-card px-5 text-[length:var(--text-m)] font-semibold"
          >
            save transcript to diary
          </button>
        </div>
      </section>
    );
  }

  if (phase === "live") {
    return (
      <section className="flex min-h-dvh flex-col bg-night pb-[env(safe-area-inset-bottom)] text-snow">
        <header className="pt-safe flex items-center gap-3 px-4 pb-2">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-[var(--radius-pill)] bg-moss ${paused ? "" : "animate-pulse"}`} />
          <span data-testid="elapsed" className="tabular-nums">
            {clock(elapsed)}
          </span>
          <button
            type="button"
            onClick={() => void stopAndLearn()}
            className="glass-dark glass-specular ml-auto flex h-11 items-center rounded-[22px] px-4 text-[15px] font-semibold"
          >
            stop
          </button>
        </header>
        {fallback && (
          <p role="status" className="px-4 text-[length:var(--text-small)] text-snow/70">
            live translation unavailable, using fallback
          </p>
        )}
        {fallbackError && (
          <p className="px-4 text-[length:var(--text-small)] text-snow/70">could not open the microphone</p>
        )}
        <ol className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {pairs.length === 0 && <li className="text-snow/60">listening for french</li>}
          {pairs.map((p) => (
            <li key={p.id} data-testid="pair" className="flex items-start gap-3">
              <div className="flex flex-1 flex-col">
                <p className={`font-display text-[length:var(--text-title)] leading-[var(--lh-title)] ${p.final ? "" : "opacity-80"}`}>
                  {p.fr}
                </p>
                {p.en && <p className="text-snow/60">{p.en}</p>}
              </div>
              <button
                type="button"
                onClick={() => toggleKept(p.id)}
                aria-pressed={p.kept}
                aria-label={`bookmark ${p.fr}`}
                className={p.kept ? "text-moss" : "text-snow/60"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill={p.kept ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75">
                  <path d="M6 3h12v18l-6-4-6 4z" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
        <div className="glass-dark glass-specular sticky bottom-4 m-4 flex gap-3 rounded-[var(--radius-capsule)] p-2">
          <button
            type="button"
            onClick={paused ? resume : pause}
            className="h-12 flex-1 rounded-[24px] text-[length:var(--text-m)] font-semibold"
          >
            {paused ? "resume" : "pause"}
          </button>
          <button
            type="button"
            onClick={() => void stopAndLearn()}
            className="h-12 flex-1 rounded-[24px] bg-moss text-[length:var(--text-m)] font-semibold text-snow"
          >
            stop and learn
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-safe pb-tabbar flex flex-col gap-5 px-[var(--gutter)]">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[length:var(--text-h1)] leading-[var(--lh-h1)] font-bold">listen</h1>
        <p className="text-muted">hear a real conversation around you, see it in both languages, keep what you want to learn.</p>
      </header>
      <p className="rounded-[var(--radius-card)] border border-line bg-card p-4 text-[length:var(--text-small)] text-muted">
        only listen where people know. audio is never stored. the transcript stays on this phone; the learn step sends its
        text once to gemini.
      </p>
      <div className="flex flex-col items-center gap-3 py-4">
        <MicButton onClick={begin} label="start listening" />
        <p className="text-[length:var(--text-small)] text-muted">start listening</p>
        <p className="text-[length:var(--text-small)]">fr -&gt; en</p>
      </div>
      <button type="button" onClick={() => setHowOpen((o) => !o)} aria-expanded={howOpen} className="self-start text-accent underline">
        how it works
      </button>
      {howOpen && (
        <ol className="flex flex-col gap-1 text-[length:var(--text-small)] text-muted">
          {HOW.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
