import type { Conversation } from "../lib/types";

const KEY = "alltag.conversations";

// In-memory fallback when localStorage is missing or throws.
let memory: Conversation[] = [];
let counter = 0;

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function load(): Conversation[] {
  const ls = storage();
  if (!ls) return memory;
  try {
    const raw = ls.getItem(KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return memory;
  }
}

function write(list: Conversation[]): void {
  memory = list;
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(KEY, JSON.stringify(list));
  } catch {
    // quota or private mode: memory copy still holds
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  counter += 1;
  return `conv-${Date.now()}-${counter}`;
}

export type SaveInput = Omit<Conversation, "id" | "keptCount"> & { id?: string };

/** Newest first. */
export function all(): Conversation[] {
  return load()
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Inserts or replaces by id; keptCount is derived from the lines. */
export function save(input: SaveInput): Conversation {
  const conv: Conversation = {
    ...input,
    id: input.id ?? newId(),
    keptCount: input.lines.filter((l) => l.kept).length,
  };
  const list = load().filter((c) => c.id !== conv.id);
  write([...list, conv]);
  return conv;
}

export function remove(id: string): void {
  write(load().filter((c) => c.id !== id));
}

export function clear(): void {
  write([]);
}
