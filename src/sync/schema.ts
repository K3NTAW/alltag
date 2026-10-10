// Row types for the Supabase tables in supabase/migrations/20261010120000_init.sql.
// This is the contract the sync layer builds on: keep the columns here and in the SQL identical.
// Timestamps are ISO strings as they come back from PostgREST.

export type Level = "A1" | "A2" | "B1" | "B2";

/** Columns every synced table carries. user_id is the auth user id (JWT sub). */
export interface SyncColumns {
  user_id: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProfileRow extends SyncColumns {
  level: Level | null;
  display_name: string | null;
  settings: Record<string, unknown>;
}

/** SM-2 state stored in items.srs. due is an ISO date. */
export interface SrsState {
  interval: number;
  ease: number;
  reps: number;
  due: string;
}

export interface ItemRow extends SyncColumns {
  id: string;
  noun_fr: string | null;
  phrase_fr: string;
  phrase_en: string | null;
  error_type: string | null;
  srs: Partial<SrsState>;
  kept_at: string | null;
}

export interface SceneRow extends SyncColumns {
  id: string;
  place: string | null;
  objects: unknown[];
  task: unknown | null;
  /** Storage path in BUCKET: `<sub>/<sceneId>.jpg`. */
  image_path: string | null;
  captured_at: string | null;
}

export interface ConversationRow extends SyncColumns {
  id: string;
  started_at: string | null;
  duration_s: number | null;
  lines: unknown[];
  kept_count: number | null;
}

export const TABLES = ["profiles", "items", "scenes", "conversations"] as const;
export type TableName = (typeof TABLES)[number];

export interface RowByTable {
  profiles: ProfileRow;
  items: ItemRow;
  scenes: SceneRow;
  conversations: ConversationRow;
}

export const BUCKET = "scenes";
