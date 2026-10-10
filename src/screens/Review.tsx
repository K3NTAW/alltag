import { useState, type FormEvent } from "react";
import { postCheck } from "../lib/api";
import { getSettings } from "../lib/settings";
import type { Card } from "../lib/types";
import { gradeFromTranscript } from "../srs/recall";
import * as store from "../srs/store";
import { useVoice } from "../voice/useVoice";
import { MicFace } from "../components/GlassButton";

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

  return (
    <section className="pt-safe pb-tabbar flex flex-col gap-4 px-[var(--gutter)]">
      <p className="text-[length:var(--text-micro)] text-muted">
        {position} of {total}
      </p>
      {card.crop ? (
        <img src={card.crop} alt={card.place ?? card.phrase_en} className="w-full rounded-[var(--radius-card)] object-cover" />
      ) : (
        card.place && <p className="text-[length:var(--text-small)] text-muted">your {card.place}</p>
      )}
      <p className="text-[length:var(--text-title)] leading-[var(--lh-title)]">say it: {card.phrase_en}</p>

      {result ? (
        <div className="flex flex-col gap-3">
          <p className={result.q >= 3 ? "text-[var(--moss)]" : "text-[var(--clay)]"}>
            {result.q >= 3 ? `good, next in ${days(result.interval)}` : "not yet, again tomorrow"}
          </p>
          <p className="text-[length:var(--text-title)]">{card.phrase_fr}</p>
          {result.said && <p className="text-[length:var(--text-small)] text-muted">you: {result.said}</p>}
          <button
            type="button"
            onClick={onNext}
            className="h-[52px] rounded-[26px] bg-accent px-5 text-[length:var(--text-m)] font-semibold text-card"
          >
            next
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onPointerDown={() => void voice?.startListening()}
            onPointerUp={() => voice?.stopListening()}
            onPointerLeave={() => voice?.stopListening()}
            className="flex flex-col items-center gap-1 self-center rounded-[var(--radius-pill)] text-[length:var(--text-micro)] font-medium tracking-[0.04em] text-muted"
          >
            <MicFace state={voice?.state === "listening" ? "listening" : busy ? "thinking" : "idle"} surface="light" />
            {voice?.state === "listening" ? "listening" : "hold to talk"}
          </button>
          {voice?.partial && <p className="text-center text-muted">{voice.partial}</p>}
          <form onSubmit={submit} className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-[length:var(--text-small)] text-muted">
              or type it
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                lang="fr"
                className="rounded-[var(--radius-button)] border border-line bg-card px-3 py-2 text-ink"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="self-end rounded-[var(--radius-button)] border border-line bg-card px-4 py-2"
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

  return (
    <section className="pt-safe pb-tabbar flex flex-col gap-4 px-[var(--gutter)]">
      <header>
        <h1 className="text-[length:var(--text-h1)] leading-[var(--lh-h1)] font-bold">review</h1>
        <p className="text-[length:var(--text-small)] text-muted">
          due now <span data-testid="due-count">{due.length}</span>
        </p>
      </header>

      {due.length === 0 ? (
        <p className="text-muted">nothing due, go look at something</p>
      ) : (
        <>
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              data-group={g.key}
              onClick={() => start(g.cards)}
              className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-card p-4 text-left"
            >
              <span className="text-[length:var(--text-title)]">
                {g.key} · {g.cards.length}
              </span>
              <span className="text-[length:var(--text-small)] text-muted">{summary(g)}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => start()}
            className="h-[52px] rounded-[26px] bg-accent px-5 text-[length:var(--text-m)] font-semibold text-card"
          >
            start
          </button>
        </>
      )}
    </section>
  );
}
