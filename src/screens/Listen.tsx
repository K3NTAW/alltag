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
import Orb from "../components/Orb";
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
  "Gemini hears the room and writes each French line as it is said.",
  "Every line gets its English right under it. Bookmark the ones you like.",
  "Stop and learn picks what is worth keeping at your level.",
];

// Waveform behind the idle orb (ListenIdle board): height px, duration s, delay s.
const BARS: [number, number, number][] = [
  [12, 1.3, -0.2], [18, 1.1, -0.7], [28, 1.5, -0.4], [38, 0.9, -0.1], [52, 1.2, -0.9], [68, 1.4, -0.5],
  [84, 1, -0.3], [96, 1.3, -0.8], [108, 1.1, -0.6], [116, 1.5, -1.1], [120, 0.9, -0.2], [124, 1.2, -0.4],
  [124, 1.4, -0.9], [120, 1, -0.1], [116, 1.3, -0.7], [108, 1.1, -0.3], [96, 1.5, -0.6], [84, 0.9, -0.5],
  [68, 1.2, -1], [52, 1.4, -0.2], [38, 1, -0.8], [28, 1.3, -0.4], [18, 1.1, -0.6], [12, 1.5, -0.3],
];

const EYEBROW = "font-mono text-[11px] leading-[14px] font-medium tracking-[0.08em] uppercase";
const PRIMARY =
  "press flex h-14 w-full items-center justify-center gap-2.5 rounded-[28px] bg-ink text-[17px] leading-[22px] font-semibold text-card shadow-[0_8px_20px_rgba(18,19,22,0.18)] disabled:opacity-50";
const TERTIARY = "press h-11 self-center text-[15px] font-semibold text-ink2 disabled:opacity-50";

function Icon({ d, size = 20, fill = "none" }: { d: string; size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill={fill} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const BOOKMARK = "M6 3h12v18l-6-4-6 4z";
const EAR = "M6 9a6 6 0 1 1 12 0c0 3-2 4-3 5.5S14 18 12 19.5 8 20 8 18M9 9a3 3 0 0 1 6 0";
const LOCK = "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3";
const PAUSE = "M9 5v14M15 5v14";
const PLAY = "M8 5v14l11-7z";
const CLOSE = "M6 6l12 12M18 6L6 18";

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
  // /api/translate results by pair id ("" when it failed); a present id means the pair is final.
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const tr = useRef<{ requested: Set<string>; gen: number }>({ requested: new Set(), gen: 0 });
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

  // Live gives only the French; its final flag here means "French done", not translated yet.
  const frPairs = fallback || paused || phase !== "live" ? [] : pairLines(live.events, `s${segment}-`);
  const withTranslation = (p: Pair): Pair => (p.id in translations ? { ...p, en: translations[p.id], final: true } : p);
  const livePairs = frPairs.map((p) => withTranslation({ ...p, final: false }));
  const pairs = [...committed, ...livePairs].map((p) => ({ ...withTranslation(p), kept: keptIds.has(p.id) }));

  // Translate a final French utterance once and fill its en. Shared by Live and the Gradium fallback.
  // Results after stop or a new start are dropped; a failure closes the pair with no English.
  const translate = useCallback((id: string, text: string) => {
    const t = tr.current;
    if (t.requested.has(id)) return;
    t.requested.add(id);
    const gen = t.gen;
    const fill = (en: string) => {
      if (gen === t.gen) setTranslations((m) => ({ ...m, [id]: en }));
    };
    postTranslate({ text, from: "fr", to: "en" })
      .then((r) => fill(r.text))
      .catch(() => fill(""));
  }, []);

  useEffect(() => {
    for (const p of frPairs) if (p.final) translate(p.id, p.fr);
  });

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
          translate(id, text);
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
  }, [translate]);

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
    tr.current = { requested: new Set(), gen: tr.current.gen + 1 };
    setTranslations({});
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
    tr.current.gen += 1;
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
      <section className="screen-enter pt-safe pb-tabbar flex flex-col gap-8 px-[var(--gutter)]">
        <header className="flex flex-col gap-2 pt-12">
          <p className={`${EYEBROW} text-ink2`}>Today</p>
          <h1 className="text-[40px] leading-[44px] tracking-[-0.01em]">From that conversation</h1>
          <p className="text-[13px] leading-[18px] text-ink2">
            {minutes} {minutes === 1 ? "minute" : "minutes"} · {learn.lines.length} {learn.lines.length === 1 ? "line" : "lines"}
          </p>
        </header>
        {learn.loading ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] leading-[21px] text-ink2">Picking what is worth keeping</p>
            {[0, 1, 2].map((i) => (
              <div key={i} aria-hidden className="shimmer h-24 rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <h2 className={`${EYEBROW} text-ink2`}>Worth keeping</h2>
              {learn.items.length === 0 && <p className="text-[15px] leading-[21px] text-ink2">Nothing picked this time</p>}
              {learn.items.map((it, i) => (
                <article
                  key={it.id}
                  data-testid="keep-card"
                  className="rise-in flex items-start gap-3 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--e1)]"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex flex-1 flex-col gap-1.5">
                    <p lang="fr" className="font-display text-[24px] leading-[30px]">
                      {it.fr}
                    </p>
                    <p className="text-[15px] leading-[21px] text-ink2">{it.en}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className={`${EYEBROW} inline-flex h-7 items-center rounded-[var(--radius-chip)] bg-[var(--sunken)] px-2.5 text-ink2`}>{it.type}</span>
                      {it.why && (
                        <span className="inline-flex h-7 items-center rounded-[var(--radius-chip)] bg-moss-soft px-2.5 text-[13px] text-moss">{it.why}</span>
                      )}
                    </div>
                  </div>
                  <label
                    className={`press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] ${
                      it.checked ? "bg-moss-soft text-moss" : "bg-[var(--sunken)] text-ink2"
                    }`}
                  >
                    <input
                      type="checkbox"
                      aria-label={`keep ${it.fr}`}
                      checked={it.checked}
                      onChange={() =>
                        setLearn((l) =>
                          l && { ...l, items: l.items.map((x) => (x.id === it.id ? { ...x, checked: !x.checked } : x)) },
                        )
                      }
                      className="absolute inset-0 cursor-pointer appearance-none rounded-[var(--radius-pill)]"
                    />
                    <span key={String(it.checked)} className="pop-in pointer-events-none">
                      <Icon d={BOOKMARK} fill={it.checked ? "currentColor" : "none"} />
                    </span>
                  </label>
                </article>
              ))}
            </section>
            {learn.known.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className={`${EYEBROW} text-ink2`}>
                  You already know · {learn.known.length}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {learn.known.map((w) => (
                    <li
                      key={w}
                      lang="fr"
                      className="inline-flex h-7 items-center rounded-[var(--radius-chip)] bg-moss-soft px-2.5 font-display text-[17px] text-moss"
                    >
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
                  className="press flex min-h-14 items-center justify-between rounded-[var(--radius-card)] bg-card px-5 text-left text-[17px] font-semibold shadow-[var(--e1)]"
                >
                  <span>Too advanced for now</span>
                  <span className="font-mono text-[11px] tracking-[0.08em] text-ink2">{learn.advanced.length}</span>
                </button>
                {advancedOpen && (
                  <ul className="flex flex-col gap-3 px-5 pt-2">
                    {learn.advanced.map((a) => (
                      <li key={a.fr} className="rise-in">
                        <p lang="fr" className="font-display text-[19px] leading-[25px]">
                          {a.fr}
                        </p>
                        <p className="text-[13px] leading-[18px] text-ink2">{a.en}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
        <div className="flex flex-col gap-1">
          <button type="button" disabled={learn.loading} onClick={keepAndReview} className={PRIMARY}>
            Keep {k} for review
          </button>
          <button type="button" disabled={learn.loading} onClick={saveTranscript} className={TERTIARY}>
            Save transcript to diary
          </button>
        </div>
      </section>
    );
  }

  if (phase === "live") {
    const last = pairs.length - 1;
    return (
      <section className="flex min-h-dvh flex-col bg-night pb-[env(safe-area-inset-bottom)] text-[var(--night-text)]">
        <header className="pt-safe flex items-center justify-between gap-3 px-[var(--gutter)] pb-2">
          <div className="glass-dark glass-specular fade-in flex h-11 items-center gap-2.5 rounded-[var(--radius-pill)] px-4 font-mono text-[11px] font-medium tracking-[0.08em] uppercase">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-[var(--radius-pill)] bg-[var(--sun-on-dark)] ${paused ? "" : "animate-[glowPulse_1.2s_var(--ease-loop)_infinite]"}`}
            />
            <span>{paused ? "Paused" : "Listening"}</span>
            <span data-testid="elapsed" className="tabular-nums">
              {clock(elapsed)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void stopAndLearn()}
            aria-label="stop"
            className="glass-dark glass-specular press flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)]"
          >
            <Icon d={CLOSE} />
          </button>
        </header>
        {fallback && (
          <p role="status" className="px-[var(--gutter)] text-[13px] leading-[18px] text-[var(--night-text2)]">
            live translation unavailable, using fallback
          </p>
        )}
        {fallbackError && (
          <p className="px-[var(--gutter)] text-[13px] leading-[18px] text-[var(--night-text2)]">could not open the microphone</p>
        )}
        <ol className="flex flex-1 flex-col justify-end gap-5 overflow-y-auto px-[var(--gutter)] py-4">
          {pairs.length === 0 && <li className="text-[15px] text-[var(--night-text2)]">Listening for French</li>}
          {pairs.map((p, i) => (
            <li key={p.id} data-testid="pair" className="rise-in flex items-start gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <p lang="fr" className={`font-display text-[19px] leading-[25px] ${p.final ? "" : "opacity-80"}`}>
                  {p.fr}
                  {!p.final && i === last && <span aria-hidden className="caret ml-0.5 inline-block h-[18px] w-0.5 translate-y-[3px] bg-current" />}
                </p>
                {p.en && <p className="text-[15px] leading-[21px] text-[var(--night-text2)]">{p.en}</p>}
                {p.kept && (
                  <span className={`${EYEBROW} pop-in mt-1 inline-flex h-7 items-center self-start rounded-[var(--radius-chip)] bg-sun/20 px-2.5 text-[var(--sun-on-dark)]`}>
                    Kept
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggleKept(p.id)}
                aria-pressed={p.kept}
                aria-label={`bookmark ${p.fr}`}
                className={`press flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] ${
                  p.kept ? "text-[var(--sun-on-dark)]" : "text-[var(--night-text2)]"
                }`}
              >
                <Icon d={BOOKMARK} fill={p.kept ? "currentColor" : "none"} />
              </button>
            </li>
          ))}
        </ol>
        <div className="glass-dark glass-specular sticky bottom-4 mx-[var(--gutter)] mb-4 flex items-center gap-3 rounded-[var(--radius-pill)] p-2">
          <button
            type="button"
            onClick={paused ? resume : pause}
            aria-label={paused ? "resume" : "pause"}
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-snow/10"
          >
            <Icon d={paused ? PLAY : PAUSE} />
          </button>
          <div className="flex flex-1 items-center justify-center gap-2">
            <Orb size={44} state={paused ? "idle" : "listening"} />
            <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-[var(--night-text2)] uppercase">
              {paused ? "Paused" : "Listening"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void stopAndLearn()}
            className="press h-11 shrink-0 rounded-[22px] bg-[var(--night-text)] px-4 text-[15px] font-semibold text-ink shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          >
            Stop and learn
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen-enter pt-safe pb-tabbar flex flex-col gap-8 px-[var(--gutter)]">
      <header className="flex flex-col gap-2.5 pt-12">
        <h1 className="text-[40px] leading-[44px] tracking-[-0.01em]">Listen</h1>
        <p className="max-w-[340px] text-[16px] leading-[23px] text-ink2">
          Hear a real conversation around you, read it in both languages, keep what you want to learn.
        </p>
      </header>
      <div className="relative flex h-[168px] items-center justify-center">
        <div aria-hidden className="absolute inset-0 flex items-center justify-between">
          {BARS.map(([h, d, delay], i) => (
            <span
              key={i}
              className="w-[3px] rounded-[2px] bg-ink/20 animate-[bar_1s_var(--ease-loop)_infinite]"
              style={{ height: h, animationDuration: `${d}s`, animationDelay: `${delay}s` }}
            />
          ))}
        </div>
        <Orb size={168} state="idle" />
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className={`${EYEBROW} inline-flex h-7 items-center rounded-[var(--radius-chip)] bg-card px-2.5 text-ink shadow-[var(--e1)]`}>FR · they speak</span>
        <span aria-hidden className="text-ink2">
          <Icon d="M5 12h14M13 6l6 6-6 6" size={16} />
        </span>
        <span className={`${EYEBROW} inline-flex h-7 items-center rounded-[var(--radius-chip)] bg-moss-soft px-2.5 text-moss`}>EN · you read</span>
      </div>
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-[var(--sunken)] p-5">
        <span className="mt-0.5 text-ink2">
          <Icon d={LOCK} />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[17px] leading-[22px] font-semibold">Stays on this phone</p>
          <p className="text-[13px] leading-[18px] text-ink2">
            Only listen where people know. Audio is never stored. The transcript stays on this phone; the learn step sends its
            text once to Gemini.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <button type="button" onClick={begin} aria-label="start listening" className={PRIMARY}>
          <Icon d={EAR} />
          Start listening
        </button>
        <button type="button" onClick={() => setHowOpen((o) => !o)} aria-expanded={howOpen} className={TERTIARY}>
          How it works
        </button>
      </div>
      {howOpen && (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-[21px] text-ink2">
          {HOW.map((l) => (
            <li key={l} className="rise-in">
              {l}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
