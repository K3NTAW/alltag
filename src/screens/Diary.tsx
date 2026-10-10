import { useState } from "react";
import type { Card, Conversation } from "../lib/types";
import * as conversations from "../srs/conversations";
import * as store from "../srs/store";

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
    <li data-testid="diary-conversation" className="col-span-2 rounded-[var(--radius-card)] border border-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="text-accent">
          <WaveGlyph />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-[length:var(--text-body)] leading-[var(--lh-body)]">
            {conv.place ?? "conversation"}, {weekdayTime(at)}
          </span>
          <span className="text-[length:var(--text-small)] text-muted">
            {conv.lines.length} lines, {conv.keptCount} kept
          </span>
        </span>
        <time dateTime={isoDate(at)} className="text-[length:var(--text-micro)] text-muted">
          {isoDate(at)}
        </time>
      </button>
      {open && (
        <ol className="flex flex-col gap-2 border-t border-line p-3">
          {conv.lines.map((l, i) => (
            <li key={i}>
              <p className={l.kept ? "text-accent" : ""}>{l.fr}</p>
              <p className="text-[length:var(--text-small)] text-muted">{l.en}</p>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function SceneTile({ card }: { card: Card }) {
  return (
    <li data-testid="diary-tile" className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
      {card.crop ? (
        <img src={card.crop} alt={card.place ?? card.phrase_fr} className="aspect-square w-full object-cover" />
      ) : (
        <div aria-hidden className="aspect-square w-full bg-line" />
      )}
      <div className="flex flex-col gap-1 p-3">
        <p className="text-[length:var(--text-body)] leading-[var(--lh-body)]">{card.phrase_fr}</p>
        {card.place && <p className="text-[length:var(--text-small)] text-muted">{card.place}</p>}
        <time dateTime={isoDate(card.learnedAt)} className="text-[length:var(--text-micro)] text-muted">
          {isoDate(card.learnedAt)}
        </time>
      </div>
    </li>
  );
}

export default function Diary() {
  const [filter, setFilter] = useState<Filter>("all");
  const entries: Entry[] = [
    ...(filter === "conversations" ? [] : store.all().map((card): Entry => ({ kind: "scene", at: card.learnedAt, card }))),
    ...(filter === "scenes"
      ? []
      : conversations.all().map((conv): Entry => ({ kind: "conversation", at: Date.parse(conv.startedAt), conv }))),
  ].sort((a, b) => b.at - a.at);
  const empty = store.all().length === 0 && conversations.all().length === 0;

  return (
    <section className="flex flex-col gap-4 p-[var(--gutter)]">
      <h1 className="text-[length:var(--text-h1)] leading-[var(--lh-h1)]">what you can say now</h1>
      <div role="group" aria-label="filter" className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-[var(--radius-chip)] border px-3 py-1 text-[length:var(--text-small)] ${
              filter === f ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {empty ? (
        <p className="text-muted">nothing kept yet, go look at something</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {entries.map((e) =>
            e.kind === "scene" ? <SceneTile key={e.card.id} card={e.card} /> : <ConversationRow key={e.conv.id} conv={e.conv} />,
          )}
        </ul>
      )}
    </section>
  );
}
