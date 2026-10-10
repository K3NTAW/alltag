import { useState, type FormEvent } from "react";
import { postCheck } from "../lib/api";
import { getSettings } from "../lib/settings";
import type { Card } from "../lib/types";
import { gradeFromTranscript } from "../srs/recall";
import * as store from "../srs/store";
import { useVoice } from "../voice/useVoice";
import Orb from "../components/Orb";

type Group = { key: string; cards: Card[] };

function groupDue(cards: Card[]): Group[] {
  const map = new Map<string, Card[]>();
  for (const c of cards) {
    const key = c.errorType ?? "phrase";
    map.set(key, [...(map.get(key) ?? []), c]);
  }
  return [...map].map(([key, cards]) => ({ key, cards }));
}

function summary(group: Group): string {
  if (group.key === "article") return "you keep dropping the article on feminine nouns";
  if (group.key === "gender") return "you keep mixing up le and la";
  return `${group.cards.length} to say again`;
}

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

async function gradeAttempt(transcript: string, target: string): Promise<number> {
  try {
    const res = await postCheck({ target_fr: target, transcript, level: getSettings().level });
    return res.grade;
  } catch {
    return gradeFromTranscript(transcript, target);
  }
}

interface Result {
  q: number;
  interval: number;
  said: string;
}

function ReviewCard({ card, position, total, onNext }: { card: Card; position: number; total: number; onNext: () => void }) {
  const [result, setResult] = useState<Result | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function attempt(transcript: string) {
    if (busy || result) return;
    setBusy(true);
    const q = await gradeAttempt(transcript, card.phrase_fr);
    const graded = store.grade(card.id, q);
    setResult({ q, interval: graded.interval, said: transcript });
    setBusy(false);
  }

  // Automocked in tests, so the hook may return undefined.
  const voice = useVoice({ onFinal: (text) => void attempt(text) }) as ReturnType<typeof useVoice> | undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    void attempt(typed);
  }

  const left = total - position;
  const right = result ? result.q >= 3 : false;

  return (
    <section className="pt-safe pb-tabbar flex flex-col gap-6 px-[var(--gutter)]">
      <div className="flex flex-col items-center gap-2.5 pt-4">
        <p className="font-mono text-[11px] leading-[14px] font-medium tracking-[0.08em] text-ink">
          {position} / {total}
        </p>
        <div aria-hidden className="h-1 w-24 overflow-hidden rounded-[2px] bg-[var(--sunken)]">
          <div className="h-full rounded-[2px] bg-moss" style={{ width: `${(position / total) * 100}%` }} />
        </div>
      </div>

      <div className="relative">
        {left > 1 && (
          <div aria-hidden className="absolute inset-0 origin-bottom translate-y-5 scale-[0.88] rounded-[28px] bg-card opacity-50 shadow-[var(--e1)]" />
        )}
        {left > 0 && (
          <div aria-hidden className="absolute inset-0 origin-bottom translate-y-2.5 scale-[0.94] rounded-[28px] bg-card opacity-80 shadow-[var(--e1)]" />
        )}
        <div
          className={`relative flex flex-col rounded-[28px] bg-card p-2.5 ${
            result
              ? `fade-in shadow-[var(--e2)] ring-2 ${right ? "ring-moss" : "ring-clay"}`
              : "rise-in shadow-[var(--e1)]"
          }`}
        >
          {card.crop ? (
            <img src={card.crop} alt={card.place ?? card.phrase_en} className="h-56 w-full rounded-[20px] object-cover" />
          ) : (
            card.place && (
              <p className="px-2.5 pt-3 font-mono text-[11px] leading-[14px] font-medium tracking-[0.08em] text-[var(--sun-ink)] uppercase">
                your {card.place}
              </p>
            )
          )}
          <div className="flex flex-col gap-3 px-2.5 pt-4 pb-3">
            <p className="text-[17px] leading-[22px] font-semibold">say it: {card.phrase_en}</p>

            {result && (
              <div className="flex items-start gap-3 border-t border-line pt-4">
                <span
                  aria-hidden
                  className={`pop-in mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-snow ${right ? "bg-moss" : "bg-clay"}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <path
                      d={right ? "M5 12.5l4.5 4.5L19 7.5" : "M7 7l10 10M17 7L7 17"}
                      className="animate-[drawCheck_var(--dur-3)_var(--ease-out)_both] [animation-delay:180ms] [stroke-dasharray:24]"
                    />
                  </svg>
                </span>
                <div className="rise-in flex min-w-0 flex-1 flex-col gap-1">
                  <p lang="fr" className="font-display text-[24px] leading-[30px]">
                    {card.phrase_fr}
                  </p>
                  <p className={`text-[13px] leading-[18px] ${right ? "text-moss" : "text-clay"}`}>
                    {right ? `good, next in ${days(result.interval)}` : "not yet, again tomorrow"}
                  </p>
                  {result.said && <p className="text-[13px] leading-[18px] text-ink2">you: {result.said}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {result ? (
        <button
          type="button"
          onClick={onNext}
          className="press h-14 w-full rounded-[28px] bg-ink px-5 text-[17px] font-semibold text-snow"
        >
          next
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onPointerDown={() => void voice?.startListening()}
            onPointerUp={() => voice?.stopListening()}
            onPointerLeave={() => voice?.stopListening()}
            className="press flex flex-col items-center gap-3 self-center rounded-[var(--radius-pill)] font-mono text-[11px] leading-[14px] font-medium tracking-[0.08em] text-ink2 uppercase"
          >
            <span aria-hidden>
              <Orb size={96} state={voice?.state === "listening" ? "listening" : busy ? "thinking" : "idle"} />
            </span>
            {voice?.state === "listening" ? "listening" : "hold to answer"}
          </button>
          {voice?.partial && (
            <p lang="fr" className="text-center font-display text-[19px] leading-[25px] text-ink2">
              {voice.partial}
            </p>
          )}
          <form onSubmit={submit} className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1.5 text-[13px] leading-[18px] text-ink2">
              or type it
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                lang="fr"
                className="h-11 rounded-[var(--radius-pill)] bg-card px-4 font-display text-[19px] text-ink shadow-[var(--e1)] outline-none focus-visible:ring-2 focus-visible:ring-moss"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="press h-11 rounded-[var(--radius-pill)] bg-card px-5 text-[15px] font-semibold text-ink shadow-[var(--e1)]"
            >
              check
            </button>
          </form>
        </>
      )}
    </section>
  );
}

export default function Review() {
  const [run, setRun] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);

  if (run && index < run.length) {
    return (
      <ReviewCard
        key={run[index].id}
        card={run[index]}
        position={index + 1}
        total={run.length}
        onNext={() => {
          if (index + 1 < run.length) setIndex(index + 1);
          else {
            setRun(null);
            setIndex(0);
          }
        }}
      />
    );
  }

  const due = store.due();
  const groups = groupDue(due);

  function start(first: Card[] = []) {
    const ids = new Set(first.map((c) => c.id));
    setRun([...first, ...due.filter((c) => !ids.has(c.id))]);
    setIndex(0);
  }

  if (due.length === 0) {
    return (
      <section className="screen-enter pt-safe pb-tabbar flex min-h-dvh flex-col gap-8 px-[var(--gutter)]">
        <header>
          <h1 className="font-display text-[40px] leading-[44px] font-normal tracking-[-0.01em]">Review</h1>
          <p className="text-[13px] leading-[18px] text-ink2">
            due now <span data-testid="due-count">{due.length}</span>
          </p>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div aria-hidden className="relative mb-4 h-36 w-56">
            <div className="absolute top-2 left-4 flex h-28 w-24 -rotate-6 items-center justify-center rounded-[var(--radius-inner)] bg-card text-ink3 shadow-[var(--e1)]">
              <CameraGlyph />
            </div>
            <div className="absolute top-4 right-4 flex h-28 w-24 rotate-4 items-center justify-center rounded-[var(--radius-inner)] bg-card text-ink3 shadow-[var(--e1)]">
              <CameraGlyph />
            </div>
            <span className="absolute top-10 left-1/2 -translate-x-1/2 animate-[floaty_var(--dur-loop)_var(--ease-loop)_infinite]">
              <Orb size={44} />
            </span>
          </div>
          <p className="text-[28px] leading-[34px] font-semibold">Nothing due</p>
          <p className="max-w-[300px] text-[16px] leading-[23px] text-ink2">
            Look at something new. What you learn today comes back tomorrow.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="screen-enter pt-safe pb-tabbar flex flex-col gap-8 px-[var(--gutter)]">
      <header>
        <h1 className="font-display text-[40px] leading-[44px] font-normal tracking-[-0.01em]">Review</h1>
        <p className="text-[13px] leading-[18px] text-ink2">
          due now <span data-testid="due-count">{due.length}</span>
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--e1)]">
        <div className="flex items-center gap-3">
          <Orb size={44} />
          <div className="flex flex-col">
            <p className="text-[17px] leading-[22px] font-semibold">Ready when you are</p>
            <p className="text-[13px] leading-[18px] text-ink2">Speak each answer, Noé checks it</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => start()}
          className="press h-14 w-full rounded-[28px] bg-ink px-5 text-[17px] font-semibold text-snow"
        >
          start
        </button>
      </div>

      {groups.map((g) => (
        <button
          key={g.key}
          type="button"
          data-group={g.key}
          onClick={() => start(g.cards)}
          className="press flex flex-col gap-3 text-left"
        >
          <span className="flex flex-col">
            <span className="text-[17px] leading-[22px] font-semibold capitalize">
              {g.key} · {g.cards.length}
            </span>
            <span className="text-[13px] leading-[18px] text-ink2">{summary(g)}</span>
          </span>
          <span className="flex flex-col gap-2">
            {g.cards.slice(0, 3).map((c) => (
              <span key={c.id} className="flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] bg-card p-2 pr-4 shadow-[var(--e1)]">
                {c.crop ? (
                  <img src={c.crop} alt="" className="h-12 w-12 shrink-0 rounded-[var(--radius-thumb)] object-cover" />
                ) : (
                  <span aria-hidden className="h-12 w-12 shrink-0 rounded-[var(--radius-thumb)] bg-[var(--sunken)]" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span lang="fr" className="truncate font-display text-[19px] leading-[25px]">
                    {c.phrase_fr}
                  </span>
                  {c.place && <span className="text-[13px] leading-[18px] text-ink2">{c.place}</span>}
                </span>
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-sun" />
              </span>
            ))}
            {g.cards.length > 3 && (
              <span className="flex h-11 items-center text-[15px] font-semibold text-ink2">{g.cards.length - 3} more</span>
            )}
          </span>
        </button>
      ))}
    </section>
  );
}

function CameraGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
