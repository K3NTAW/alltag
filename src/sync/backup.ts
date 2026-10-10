import { useSyncExternalStore } from "react";
import type { Card } from "../lib/types";
import * as store from "../srs/store";
import type { ItemRow, SrsState } from "./schema";
import { withSession } from "./supabase";

// Add-only card backup. Signed in, every local card is upserted to items and every
// remote row missing here is added. Nothing is ever deleted on either side.

export type BackupState = "off" | "working" | "ok" | "error" | "offline";

export interface BackupStatus {
  state: BackupState;
  lastOkAt: number | null;
}

export type BackupRow = Omit<ItemRow, "updated_at" | "deleted_at">;
export type RestoreRow = Pick<ItemRow, "id" | "noun_fr" | "phrase_fr" | "phrase_en" | "error_type" | "srs" | "kept_at">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHUNK = 200;
const PAGE = 1000;
const COLUMNS = "id,noun_fr,phrase_fr,phrase_en,error_type,srs,kept_at";

function iso(ms: number): string {
  return new Date(Number.isFinite(ms) ? ms : Date.now()).toISOString();
}

function ms(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function isBackedUp(card: Card): boolean {
  return UUID.test(card.id);
}

/** Allow-list only: never crop, deleted_at or updated_at. */
export function cardToRow(card: Card, userId: string): BackupRow {
  const srs: SrsState = {
    interval: card.interval,
    ease: card.ease,
    reps: card.reps,
    due: iso(card.due),
    learnedAt: iso(card.learnedAt),
  };
  if (card.objectId !== undefined) srs.objectId = card.objectId;
  if (card.place !== undefined) srs.place = card.place;
  return {
    id: card.id,
    user_id: userId,
    noun_fr: card.noun_fr ?? null,
    phrase_fr: card.phrase_fr,
    phrase_en: card.phrase_en ?? null,
    error_type: card.errorType ?? null,
    srs,
    kept_at: iso(card.learnedAt),
  };
}

/** Inverse of cardToRow. Unreadable review state restores as a fresh card. */
export function rowToCard(row: RestoreRow): Card {
  const now = Date.now();
  const srs: Record<string, unknown> = row.srs && typeof row.srs === "object" ? (row.srs as Record<string, unknown>) : {};
  const ease = num(srs.ease);
  const interval = num(srs.interval);
  const reps = num(srs.reps);
  const due = ms(srs.due);
  const valid = ease !== undefined && interval !== undefined && reps !== undefined && due !== undefined;
  const card: Card = {
    id: row.id,
    phrase_fr: row.phrase_fr,
    // Card.phrase_en is a required string; an empty one renders the same as a missing one.
    phrase_en: row.phrase_en ?? "",
    ease: valid ? ease : 2.5,
    interval: valid ? interval : 0,
    reps: valid ? reps : 0,
    due: valid ? due : now,
    learnedAt: ms(srs.learnedAt) ?? ms(row.kept_at) ?? now,
  };
  if (row.noun_fr != null) card.noun_fr = row.noun_fr;
  if (row.error_type != null) card.errorType = row.error_type as Card["errorType"];
  const objectId = str(srs.objectId);
  if (objectId !== undefined) card.objectId = objectId;
  const place = str(srs.place);
  if (place !== undefined) card.place = place;
  return card;
}

// Status: a tiny observable for Settings.

const OFF: BackupStatus = { state: "off", lastOkAt: null };
let status: BackupStatus = OFF;
const listeners = new Set<() => void>();

function setStatus(next: BackupStatus): void {
  status = next;
  listeners.forEach((l) => l());
}

export function getBackupStatus(): BackupStatus {
  return status;
}

export function subscribeBackupStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useBackupStatus(): BackupStatus {
  return useSyncExternalStore(subscribeBackupStatus, getBackupStatus);
}

// Active user: a run that ends under a different user writes nothing.

let active: { userId: string } | null = null;

export function setActiveUser(userId: string | null): void {
  if (userId === null) {
    active = null;
    setStatus(OFF);
    return;
  }
  if (active?.userId !== userId) active = { userId };
}

// Single flight: restore and backup share one lock. Requests during a run coalesce into one rerun each.

type Kind = "restore" | "backup";

interface Queued {
  promise: Promise<boolean>;
  resolve: (ok: boolean) => void;
}

let busy = false;
let queued: Partial<Record<Kind, Queued>> = {};

function request(kind: Kind): Promise<boolean> {
  if (busy) {
    let q = queued[kind];
    if (!q) {
      let resolve!: (ok: boolean) => void;
      const promise = new Promise<boolean>((r) => (resolve = r));
      q = { promise, resolve };
      queued[kind] = q;
    }
    return q.promise;
  }
  busy = true;
  const first = exec(kind);
  void first.then(drain);
  return first;
}

async function drain(): Promise<void> {
  for (;;) {
    const kind: Kind | undefined = queued.restore ? "restore" : queued.backup ? "backup" : undefined;
    if (!kind) break;
    const q = queued[kind]!;
    delete queued[kind];
    q.resolve(await exec(kind));
  }
  busy = false;
}

async function exec(kind: Kind): Promise<boolean> {
  const owner = active;
  const write = (next: BackupStatus) => {
    if (active === owner) setStatus(next);
  };
  if (kind === "backup" && typeof navigator !== "undefined" && navigator.onLine === false) {
    write({ state: "offline", lastOkAt: status.lastOkAt });
    return false;
  }
  write({ state: "working", lastOkAt: status.lastOkAt });
  try {
    const done = kind === "backup" ? await backup() : await restore(() => active === owner);
    if (done === null) {
      write({ state: "off", lastOkAt: status.lastOkAt });
      return false;
    }
    write({ state: "ok", lastOkAt: Date.now() });
    return true;
  } catch {
    write({ state: "error", lastOkAt: status.lastOkAt });
    return false;
  }
}

function backup(): Promise<true | null> {
  return withSession(async (client, userId) => {
    const rows = store
      .all()
      .filter(isBackedUp)
      .map((c) => cardToRow(c, userId));
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await client.from("items").upsert(rows.slice(i, i + CHUNK), { onConflict: "id" });
      if (error) throw error;
    }
    return true as const;
  });
}

function restore(current: () => boolean): Promise<true | null> {
  return withSession(async (client) => {
    const rows: RestoreRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client
        .from("items")
        .select(COLUMNS)
        .is("deleted_at", null)
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const page = (data ?? []) as RestoreRow[];
      rows.push(...page);
      if (page.length < PAGE) break;
    }
    // A run that outlived its user must not add that user's cards here.
    if (current()) store.addRestored(rows.map(rowToCard));
    return true as const;
  });
}

/** Upserts every local card. Never throws; the outcome is in the status. */
export function runBackup(): Promise<boolean> {
  return request("backup");
}

/** Adds remote cards missing here. True on success. Never throws. */
export function runRestore(): Promise<boolean> {
  return request("restore");
}

export function __resetBackupForTests(): void {
  active = null;
  busy = false;
  queued = {};
  status = OFF;
}
