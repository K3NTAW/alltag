import { useState } from "react";
import { go } from "../lib/screen";
import { session } from "../lib/session";
import type { Correction } from "../lib/types";
import * as store from "../srs/store";

function CorrectionCard({ c }: { c: Correction }) {
  return (
    <li data-testid="correction" className="flex flex-col gap-2 rounded-[var(--radius-m)] bg-card p-4 shadow">
      <p className="text-[length:var(--text-s)] text-muted">you said</p>
      <p>{c.said}</p>
      <p className="text-[length:var(--text-s)] text-muted">better</p>
      <p className="text-[length:var(--text-l)]">{c.better}</p>
      <span className="self-start rounded-[var(--radius-pill)] border border-line px-3 py-1 text-[length:var(--text-s)]">
        {c.type}
      </span>
      <p className="text-[length:var(--text-s)] text-muted">{c.why_en}</p>
    </li>
  );
}

function ExchangeDone({ phrases }: { phrases: string[] }) {
  return (
    <section className="flex min-h-screen flex-col gap-4 p-4">
      <div className="relative overflow-hidden rounded-[var(--radius-m)] bg-card">
        {session.frame && <img src={session.frame} alt={session.scene?.place ?? ""} className="block w-full opacity-60" />}
        <div className="flex flex-col gap-2 p-4">
          <p className="text-[length:var(--text-s)] text-muted">you can now say</p>
          <ul className="flex flex-col gap-1">
            {phrases.map((p) => (
              <li key={p} className="text-[length:var(--text-l)]">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => go("look")}
          className="flex-1 rounded-[var(--radius-pill)] border border-line px-4 py-2"
        >
          look again
        </button>
        <button
          type="button"
          onClick={() => go("review")}
          className="flex-1 rounded-[var(--radius-pill)] bg-accent px-4 py-2 text-card"
        >
          review
        </button>
      </div>
    </section>
  );
}

export default function Corrections() {
  const exchange = session.lastExchange;
  const [kept, setKept] = useState<string[] | null>(null);

  if (kept) return <ExchangeDone phrases={kept} />;

  const corrections = exchange?.corrections ?? [];
  const keptPhrases = exchange?.kept_phrase_fr ?? [];

  function keepAll() {
    const place = session.scene?.place;
    const crop = session.frame ?? undefined;
    for (const c of corrections) {
      store.keep({ phrase_fr: c.better, phrase_en: c.why_en, noun_fr: c.better, errorType: c.type, place, crop });
    }
    for (const phrase_fr of keptPhrases) {
      store.keep({ phrase_fr, phrase_en: "", place, crop });
    }
    setKept([...new Set([...corrections.map((c) => c.better), ...keptPhrases])]);
  }

  return (
    <section className="flex min-h-screen flex-col gap-4 p-4">
      {corrections.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-m)] bg-card p-4 shadow">
          <p>nothing to fix, nice</p>
          {keptPhrases.map((p) => (
            <p key={p} className="text-[length:var(--text-l)]">
              {p}
            </p>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {corrections.map((c) => (
            <CorrectionCard key={`${c.said}|${c.better}`} c={c} />
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={keepAll}
        className="rounded-[var(--radius-pill)] bg-accent px-5 py-2 text-card"
      >
        keep both and continue
      </button>
    </section>
  );
}
