import type { Card } from "../lib/types";
import * as store from "../srs/store";
import {
  __resetBackupForTests,
  cardToRow,
  getBackupStatus,
  rowToCard,
  runBackup,
  runRestore,
  setActiveUser,
  type RestoreRow,
} from "./backup";

const db = vi.hoisted(() => {
  const state = {
    signedIn: true,
    remote: [] as unknown[],
    upserts: [] as { rows: Record<string, unknown>[]; opts: unknown }[],
    ranges: [] as [number, number][],
    log: [] as string[],
    upsertError: null as unknown,
    selectError: null as unknown,
    throwOnUpsert: false,
    gate: null as Promise<void> | null,
    inFlight: 0,
    maxInFlight: 0,
  };
  async function hold<T>(label: string, fn: () => T): Promise<T> {
    state.log.push(label);
    state.inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    try {
      if (state.gate) await state.gate;
      return fn();
    } finally {
      state.inFlight -= 1;
    }
  }
  const client = {
    from: vi.fn((table: string) => ({
      upsert: (rows: Record<string, unknown>[], opts: unknown) =>
        hold(`upsert:${table}`, () => {
          if (state.throwOnUpsert) throw new Error("network");
          state.upserts.push({ rows, opts });
          return { error: state.upsertError };
        }),
      select: (cols: string) => ({
        is: (col: string, value: unknown) => ({
          order: (by: string) => ({
            range: (from: number, to: number) =>
              hold(`select:${table}`, () => {
                state.ranges.push([from, to]);
                expect([cols, col, value, by]).toEqual([
                  "id,noun_fr,phrase_fr,phrase_en,error_type,srs,kept_at",
                  "deleted_at",
                  null,
                  "id",
                ]);
                if (state.selectError) return { data: null, error: state.selectError };
                return { data: state.remote.slice(from, to + 1), error: null };
              }),
          }),
        }),
      }),
    })),
  };
  return { state, client };
});

vi.mock("./supabase", async () => ({
  ...(await vi.importActual<typeof import("./supabase")>("./supabase")),
  withSession: vi.fn(async (fn: (client: never, userId: string) => Promise<unknown>) =>
    db.state.signedIn ? fn(db.client as never, "u1") : null,
  ),
}));

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function card(n: number, over: Partial<Card> = {}): Card {
  return {
    id: uuid(n),
    phrase_fr: `phrase ${n}`,
    phrase_en: `en ${n}`,
    ease: 2.5,
    interval: 0,
    reps: 0,
    due: Date.UTC(2026, 9, 10),
    learnedAt: Date.UTC(2026, 9, 1),
    ...over,
  };
}

function remoteRow(n: number, over: Partial<RestoreRow> = {}): RestoreRow {
  const { user_id: _u, ...row } = cardToRow(card(n, { phrase_fr: `remote ${n}` }), "u1");
  void _u;
  return { ...row, ...over };
}

function seed(cards: Card[]) {
  localStorage.setItem("alltag.cards", JSON.stringify(cards));
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  localStorage.clear();
  store.clear();
  __resetBackupForTests();
  Object.assign(db.state, {
    signedIn: true,
    remote: [],
    upserts: [],
    ranges: [],
    log: [],
    upsertError: null,
    selectError: null,
    throwOnUpsert: false,
    gate: null,
    inFlight: 0,
    maxInFlight: 0,
  });
  setActiveUser("u1");
});

afterEach(() => vi.restoreAllMocks());

describe("mapping", () => {
  it("round trips through the allow-list and drops the crop", () => {
    const c = card(1, {
      noun_fr: "le café",
      objectId: "o1",
      place: "café",
      crop: "data:image/jpeg;base64,AAAA",
      errorType: "article",
      ease: 2.6,
      interval: 6,
      reps: 2,
    });
    const row = cardToRow(c, "u1");
    expect(Object.keys(row).sort()).toEqual(
      ["error_type", "id", "kept_at", "noun_fr", "phrase_en", "phrase_fr", "srs", "user_id"].sort(),
    );
    expect(JSON.stringify(row)).not.toContain("crop");
    expect(row.kept_at).toBe("2026-10-01T00:00:00.000Z");
    expect(row.srs).toEqual({
      interval: 6,
      ease: 2.6,
      reps: 2,
      due: "2026-10-10T00:00:00.000Z",
      learnedAt: "2026-10-01T00:00:00.000Z",
      objectId: "o1",
      place: "café",
    });
    const { crop: _crop, ...rest } = c;
    void _crop;
    expect(rowToCard(row)).toEqual(rest);
  });

  it("maps undefined to null and null back to missing", () => {
    const row = cardToRow(card(2), "u1");
    expect(row).toMatchObject({ noun_fr: null, error_type: null });
    expect(row.srs).not.toHaveProperty("objectId");
    expect(row.srs).not.toHaveProperty("place");
    const back = rowToCard({ ...row, phrase_en: null });
    expect(back).not.toHaveProperty("noun_fr");
    expect(back).not.toHaveProperty("errorType");
    expect(back).not.toHaveProperty("objectId");
    expect(back).not.toHaveProperty("place");
    expect(back.phrase_en).toBe("");
  });

  it("falls back to fresh review state on a bad srs", () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    for (const srs of [{}, { ease: "x", interval: 1, reps: 1, due: "2026-10-10T00:00:00Z" }, { ease: 2, interval: 1, reps: 1, due: "nope" }]) {
      const c = rowToCard(remoteRow(3, { srs, kept_at: "2026-10-02T00:00:00.000Z" }));
      expect(c).toMatchObject({ ease: 2.5, interval: 0, reps: 0, due: 5_000, learnedAt: Date.UTC(2026, 9, 2) });
    }
    expect(rowToCard(remoteRow(3, { srs: null as never, kept_at: null })).learnedAt).toBe(5_000);
  });
});

describe("runBackup", () => {
  it("skips non-uuid ids", async () => {
    seed([card(1), { ...card(2), id: "card-1-1" }]);
    await runBackup();
    expect(db.state.upserts.flatMap((u) => u.rows.map((r) => r.id))).toEqual([uuid(1)]);
  });

  it("upserts in chunks of 200 on id without deleted_at", async () => {
    seed(Array.from({ length: 450 }, (_, i) => card(i + 1)));
    vi.spyOn(Date, "now").mockReturnValue(42);
    await runBackup();
    expect(db.state.upserts.map((u) => u.rows.length)).toEqual([200, 200, 50]);
    for (const u of db.state.upserts) {
      expect(u.opts).toEqual({ onConflict: "id" });
      for (const r of u.rows) {
        expect(r).not.toHaveProperty("deleted_at");
        expect(r).not.toHaveProperty("updated_at");
        expect(r.user_id).toBe("u1");
      }
    }
    expect(getBackupStatus()).toEqual({ state: "ok", lastOkAt: 42 });
  });

  it("a returned error sets error without throwing", async () => {
    seed([card(1)]);
    db.state.upsertError = { message: "rls" };
    await expect(runBackup()).resolves.toBe(false);
    expect(getBackupStatus().state).toBe("error");
  });

  it("a thrown error sets error without throwing", async () => {
    seed([card(1)]);
    db.state.throwOnUpsert = true;
    await expect(runBackup()).resolves.toBe(false);
    expect(getBackupStatus().state).toBe("error");
  });

  it("offline: no call, status offline", async () => {
    seed([card(1)]);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await runBackup();
    expect(db.state.log).toEqual([]);
    expect(getBackupStatus().state).toBe("offline");
  });

  it("signed out: status off, no call", async () => {
    seed([card(1)]);
    db.state.signedIn = false;
    await runBackup();
    expect(db.state.log).toEqual([]);
    expect(getBackupStatus().state).toBe("off");
  });
});

describe("single flight", () => {
  it("shares one lock across restore and backup and reruns once", async () => {
    seed([card(1)]);
    let release!: () => void;
    db.state.gate = new Promise((r) => (release = r));
    const first = runRestore();
    const a = runBackup();
    const b = runBackup();
    const c = runRestore();
    await flush();
    expect(db.state.log).toEqual(["select:items"]);
    release();
    await Promise.all([first, a, b, c]);
    await flush();
    expect(db.state.log).toEqual(["select:items", "select:items", "upsert:items"]);
    expect(db.state.maxInFlight).toBe(1);
    await runBackup();
    expect(db.state.log).toHaveLength(4);
  });
});

describe("runRestore", () => {
  it("fetches a second page when the first has 1000 rows", async () => {
    db.state.remote = Array.from({ length: 1200 }, (_, i) => remoteRow(i + 1));
    await expect(runRestore()).resolves.toBe(true);
    expect(db.state.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(store.all()).toHaveLength(1200);
    expect(getBackupStatus().state).toBe("ok");
  });

  it("adds only missing ids and never overwrites a local card", async () => {
    const local = card(1, { phrase_fr: "local 1", reps: 4 });
    seed([local]);
    db.state.remote = [remoteRow(1), remoteRow(2)];
    await runRestore();
    expect(store.get(uuid(1))).toEqual(local);
    expect(store.get(uuid(2))?.phrase_fr).toBe("remote 2");
    expect(store.all()).toHaveLength(2);
  });

  it("an error returns false and sets error", async () => {
    db.state.selectError = { message: "boom" };
    await expect(runRestore()).resolves.toBe(false);
    expect(getBackupStatus().state).toBe("error");
  });
});

describe("stale runs", () => {
  it("write no status after setActiveUser(null)", async () => {
    seed([card(1)]);
    db.state.remote = [remoteRow(2)];
    let release!: () => void;
    db.state.gate = new Promise((r) => (release = r));
    const restore = runRestore();
    await flush();
    setActiveUser(null);
    expect(getBackupStatus()).toEqual({ state: "off", lastOkAt: null });
    release();
    await restore;
    await flush();
    expect(getBackupStatus()).toEqual({ state: "off", lastOkAt: null });
    expect(store.get(uuid(2))).toBeUndefined();
  });
});
