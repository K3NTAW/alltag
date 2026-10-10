import { useState } from "react";
import type { Card, Conversation } from "../lib/types";
import * as conversations from "../srs/conversations";
import * as store from "../srs/store";
import Orb from "../components/Orb";

type Filter = "all" | "scenes" | "conversations";
const FILTERS: Filter[] = ["all", "scenes", "conversations"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

type Entry = { kind: "scene"; at: number; card: Card } | { kind: "conversation"; at: number; conv: Conversation };

const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weekdayTime(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function WaveGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2" />
    </svg>
  );
}

function ConversationRow({ conv }: { conv: Conversation }) {
  const [open, setOpen] = useState(false);
  const at = Date.parse(conv.startedAt);
  return (
    <li data-testid="diary-conversation" className="col-span-2 rounded-[var(--radius-card)] bg-card shadow-[var(--e1)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="press flex min-h-16 w-full items-center gap-3 p-4 text-left"
      >
        <span aria-hidden className="relative flex shrink-0 items-center">
          <Orb size={28} />
        </span>
        <span className="text-moss">
          <WaveGlyph />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[17px] leading-[22px] font-semibold">
            {conv.place ?? "conversation"}, {weekdayTime(at)}
          </span>
          <span className="text-[13px] leading-[18px] text-ink2">
            {conv.lines.length} lines, {conv.keptCount} kept
          </span>
        </span>
        <time dateTime={isoDate(at)} className="font-mono text-[10px] leading-[14px] font-medium tracking-[0.08em] text-ink2">
          {isoDate(at)}
        </time>
      </button>
      {open && (
        <ol className="fade-in flex flex-col gap-3 border-t border-line px-5 py-4">
          {conv.lines.map((l, i) => (
            <li key={i} className="flex flex-col gap-0.5">
              <p lang="fr" className={`font-display text-[19px] leading-[25px] ${l.kept ? "text-moss" : ""}`}>
                {l.fr}
              </p>
              <p className="text-[15px] leading-[21px] text-ink2">{l.en}</p>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function SceneTile({ card }: { card: Card }) {
  return (
    <li
      data-testid="diary-tile"
      className="relative h-[210px] overflow-hidden rounded-[20px] bg-[var(--raised)] text-snow shadow-[var(--e1)]"
    >
      {card.crop ? (
        <img src={card.crop} alt={card.place ?? card.phrase_fr} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-linear-to-br from-sun/25 via-[var(--raised)] to-night" />
      )}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-night/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3">
        <p lang="fr" className="font-display text-[19px] leading-[25px]">
          {card.phrase_fr}
        </p>
        <p className="font-mono text-[10px] leading-[14px] font-medium tracking-[0.08em] text-snow/70 uppercase">
          <time dateTime={isoDate(card.learnedAt)}>{isoDate(card.learnedAt)}</time>
          {card.place && <> · {card.place}</>}
        </p>
      </div>
    </li>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function Diary() {
  const [filter, setFilter] = useState<Filter>("all");
  const cards = store.all();
  const convs = conversations.all();
  const entries: Entry[] = [
    ...(filter === "conversations" ? [] : cards.map((card): Entry => ({ kind: "scene", at: card.learnedAt, card }))),
    ...(filter === "scenes"
      ? []
      : convs.map((conv): Entry => ({ kind: "conversation", at: Date.parse(conv.startedAt), conv }))),
  ].sort((a, b) => b.at - a.at);
  const empty = cards.length === 0 && convs.length === 0;
  const places = new Set(cards.map((c) => c.place).filter(Boolean)).size;

  return (
    <section className="screen-enter pt-safe pb-tabbar flex flex-col gap-6 px-[var(--gutter)]">
      <header>
        <h1 className="font-display text-[40px] leading-[44px] font-normal tracking-[-0.01em]">Diary</h1>
        <p className="text-[13px] leading-[18px] text-ink2">
          {plural(cards.length, "phrase")} · {plural(places, "place")} · {plural(convs.length, "conversation")}
        </p>
      </header>
      <div role="group" aria-label="filter" className="flex rounded-[var(--radius-pill)] bg-[var(--sunken)] p-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`press h-9 flex-1 rounded-[var(--radius-pill)] text-[13px] font-semibold capitalize ${
              filter === f ? "bg-card text-ink shadow-[var(--e1)]" : "text-ink2"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {empty ? (
        <p className="text-[16px] leading-[23px] text-ink2">nothing kept yet, go look at something</p>
      ) : (
        <ul className="screen-enter grid grid-cols-2 gap-3">
          {entries.map((e) =>
            e.kind === "scene" ? <SceneTile key={e.card.id} card={e.card} /> : <ConversationRow key={e.conv.id} conv={e.conv} />,
          )}
        </ul>
      )}
    </section>
  );
}
