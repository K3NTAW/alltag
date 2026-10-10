import type { Card } from "../lib/types";

const KEY = "alltag.cards";
const DAY = 24 * 60 * 60 * 1000;

export type KeepInput = Omit<Card, "id" | "ease" | "interval" | "reps" | "due" | "learnedAt"> & {
  id?: string;
};

// In-memory fallback when localStorage is missing or throws.
let memory: Card[] = [];
let counter = 0;
const subscribers = new Set<() => void>();

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function load(): Card[] {
  const ls = storage();
  if (!ls) return memory;
  try {
    const raw = ls.getItem(KEY);
    return raw ? (JSON.parse(raw) as Card[]) : [];
  } catch {
    return memory;
  }
}

function save(cards: Card[]): void {
  memory = cards;
  const ls = storage();
  if (ls) {
    try {
      ls.setItem(KEY, JSON.stringify(cards));
    } catch {
      // quota or private mode: memory copy still holds
    }
  }
  subscribers.forEach((fn) => fn());
}

/** fn runs after every save. Returns the unsubscribe. */
export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  counter += 1;
  return `card-${Date.now()}-${counter}`;
}

export function keep(input: KeepInput): Card {
  const cards = load();
  const existing = cards.find(
    (c) =>
      c.noun_fr !== undefined &&
      c.noun_fr === input.noun_fr &&
      c.errorType === input.errorType,
  );
  if (existing) return existing;
  const now = Date.now();
  const card: Card = {
    ...input,
    id: input.id ?? newId(),
    ease: 2.5,
    interval: 0,
    reps: 0,
    due: now,
    learnedAt: now,
  };
  save([...cards, card]);
  return card;
}

export function all(): Card[] {
  return load();
}

export function get(id: string): Card | undefined {
  return load().find((c) => c.id === id);
}

export function due(now = Date.now()): Card[] {
  return load()
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due);
}

export function byNoun(noun_fr: string): Card | undefined {
  return load().find((c) => c.noun_fr === noun_fr);
}

export function grade(id: string, q: number, now = Date.now()): Card {
  const cards = load();
  const i = cards.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`card ${id} not found`);
  const card = cards[i];
  const quality = Math.max(0, Math.min(5, Math.round(q)));
  let reps: number;
  let interval: number;
  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps = card.reps + 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(card.interval * card.ease);
  }
  const ease = Math.max(
    1.3,
    card.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
  );
  const next: Card = { ...card, reps, interval, ease, due: now + interval * DAY };
  const copy = cards.slice();
  copy[i] = next;
  save(copy);
  return next;
}

export function remove(id: string): void {
  save(load().filter((c) => c.id !== id));
}

export function clear(): void {
  save([]);
}

/**
 * Appends restored cards whose id is not already here (first wins, also within the batch).
 * Never overwrites or removes a local card. Saves once, or not at all when nothing is new.
 */
export function addRestored(cards: Card[]): number {
  const current = load();
  const seen = new Set(current.map((c) => c.id));
  const added: Card[] = [];
  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    added.push(card);
  }
  if (added.length === 0) return 0;
  save([...current, ...added]);
  return added.length;
}
