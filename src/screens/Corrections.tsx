import { useState } from "react";
import { go } from "../lib/screen";
import { session } from "../lib/session";
import type { Correction } from "../lib/types";
import * as store from "../srs/store";

const EYEBROW = "font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.08em]";
const PHRASE_M = "font-display text-[24px] leading-[30px]";
const PRIMARY = "press flex h-14 w-full items-center justify-center gap-2 rounded-[28px] bg-ink px-6 text-[17px] font-semibold text-snow";

// Correction reveal (STYLE-V3 motion 9): card rises, wrong words strike left to right, then Better rises and its underline draws in.
function CorrectionCard({ c, index }: { c: Correction; index: number }) {
  const enter = index * 120;
  const strikeAt = enter + 360;
  const betterAt = strikeAt + 280 + 200;
  return (
    <li
      data-testid="correction"
      className="rise-in flex flex-col gap-3 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--e1)]"
      style={{ animationDelay: `${enter}ms` }}
    >
      <div className="flex gap-1.5">
        <span className={`inline-flex h-7 items-center rounded-[var(--radius-chip)] bg-clay-soft px-2.5 text-clay ${EYEBROW}`}>
          {c.type}
        </span>
      </div>
      <p className={`${EYEBROW} text-ink2`}>you said</p>
      <p className={`${PHRASE_M} text-clay`}>
        <span
          className="bg-no-repeat [box-decoration-break:clone]"
          style={{
            backgroundImage: "linear-gradient(color-mix(in srgb, var(--clay) 60%, transparent), color-mix(in srgb, var(--clay) 60%, transparent))",
            backgroundPosition: "0 58%",
            backgroundSize: "100% 2px",
            animation: `strike 280ms var(--ease-out) ${strikeAt}ms both`,
          }}
        >
          {c.said}
        </span>
      </p>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="rotate-90 text-ink2">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
      <p className={`${EYEBROW} text-moss`}>better</p>
      <p className={`rise-in ${PHRASE_M} text-ink`} style={{ animationDelay: `${betterAt}ms` }}>
        <span
          className="bg-no-repeat pb-1 [box-decoration-break:clone]"
          style={{
            backgroundImage: "linear-gradient(var(--moss), var(--moss))",
            backgroundPosition: "0 100%",
            backgroundSize: "100% 2px",
            animation: `underline 220ms var(--ease-out) ${betterAt + 360}ms both`,
          }}
        >
          {c.better}
        </span>
      </p>
      <p className="text-[15px] leading-[21px] text-ink2">{c.why_en}</p>
    </li>
  );
}

const FLOATERS = [
  { left: "12%", top: 18, size: 14, tone: "bg-moss-soft", delay: 0 },
  { left: "34%", top: 4, size: 10, tone: "bg-[var(--sun-soft)]", delay: 600 },
  { left: "58%", top: 22, size: 18, tone: "bg-moss-soft", delay: 1200 },
  { left: "76%", top: 6, size: 12, tone: "bg-[var(--sun-soft)]", delay: 300 },
  { left: "88%", top: 28, size: 10, tone: "bg-moss-soft", delay: 900 },
];

function ExchangeDone({ phrases }: { phrases: string[] }) {
  const place = session.scene?.place;
  return (
    <section className="pb-tabbar flex min-h-dvh flex-col">
      <div className="fade-in relative h-[260px] overflow-hidden bg-[var(--sunken)]">
        {session.frame && <img src={session.frame} alt={session.scene?.place ?? ""} className="block h-full w-full object-cover" />}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-b from-transparent to-paper" />
        {place && (
          <span className="pop-in absolute bottom-4 left-[var(--gutter)] inline-flex h-7 items-center rounded-[var(--radius-pill)] bg-[var(--sun-soft)] px-3 text-[13px] leading-[18px] text-[color:var(--sun-ink)]">
            today · {place}
          </span>
        )}
      </div>
      <div className="screen-enter flex flex-col gap-8 px-[var(--gutter)] pt-4">
        <div className="relative">
          {FLOATERS.map((f, i) => (
            <span
              key={i}
              aria-hidden
              className={`pointer-events-none absolute rounded-full ${f.tone}`}
              style={{
                left: f.left,
                top: -f.top,
                width: f.size,
                height: f.size,
                animation: `floaty var(--dur-loop) var(--ease-loop) ${f.delay}ms infinite`,
              }}
            />
          ))}
          <h1 className="relative text-[40px] leading-[44px] tracking-[-0.01em]">You can now say</h1>
        </div>
        <ul className="flex flex-col gap-3">
          {phrases.map((p, i) => (
            <li
              key={p}
              className="flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] bg-card px-5 py-4 shadow-[var(--e1)]"
            >
              <span className="min-w-0 flex-1 font-display text-[19px] leading-[25px]">{p}</span>
              <span
                aria-hidden
                className="pop-in flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-moss text-snow"
                style={{ animationDelay: `${400 + i * 120}ms` }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    strokeDasharray="24"
                    style={{ animation: `drawCheck var(--dur-3) var(--ease-out) ${520 + i * 120}ms both` }}
                  />
                </svg>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={() => go("look")} className={PRIMARY}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            look again
          </button>
          <button
            type="button"
            onClick={() => go("review")}
            className="press h-11 px-4 text-[15px] font-semibold text-ink2"
          >
            review
          </button>
        </div>
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
    <section className="pt-safe pb-tabbar flex min-h-dvh flex-col gap-8 px-[var(--gutter)]">
      <header className="fade-in flex h-11 items-center justify-between">
        <h1 className={`${EYEBROW} font-mono text-ink2`}>after the chat</h1>
        {corrections.length > 0 && (
          <span className="text-[13px] leading-[18px] text-ink2">
            {corrections.length} {corrections.length === 1 ? "thing" : "things"}
          </span>
        )}
      </header>
      {corrections.length === 0 ? (
        <div className="rise-in flex flex-col gap-3 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--e1)]">
          <p className="text-[17px] leading-[22px] font-semibold">nothing to fix, nice</p>
          {keptPhrases.map((p) => (
            <p key={p} className={PHRASE_M}>
              {p}
            </p>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {corrections.map((c, i) => (
            <CorrectionCard key={`${c.said}|${c.better}`} c={c} index={i} />
          ))}
        </ul>
      )}
      <button type="button" onClick={keepAll} className={PRIMARY}>
        keep both and continue
      </button>
    </section>
  );
}
