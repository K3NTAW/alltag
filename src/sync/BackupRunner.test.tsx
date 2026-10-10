import { act, render } from "@testing-library/react";
import { AuthContext, DISABLED, type AuthValue } from "../auth/auth";
import type { Card } from "../lib/types";
import * as store from "../srs/store";
import { __resetBackupForTests, getBackupStatus } from "./backup";
import BackupRunner from "./BackupRunner";
import { withSession } from "./supabase";

const db = vi.hoisted(() => {
  const state = { log: [] as string[], upsertError: null as unknown, selectError: null as unknown };
  const client = {
    from: vi.fn(() => ({
      upsert: async () => {
        state.log.push("upsert");
        return { error: state.upsertError };
      },
      select: () => ({
        is: () => ({
          order: () => ({
            range: async () => {
              state.log.push("select");
              return state.selectError ? { data: null, error: state.selectError } : { data: [], error: null };
            },
          }),
        }),
      }),
    })),
  };
  return { state, client };
});

vi.mock("./supabase", async () => ({
  ...(await vi.importActual<typeof import("./supabase")>("./supabase")),
  withSession: vi.fn(async (fn: (client: never, userId: string) => Promise<unknown>) => fn(db.client as never, "u1")),
}));

const CARD: Card = {
  id: "00000000-0000-4000-8000-000000000001",
  phrase_fr: "un café",
  phrase_en: "a coffee",
  ease: 2.5,
  interval: 0,
  reps: 0,
  due: 0,
  learnedAt: 0,
};

function auth(over: Partial<AuthValue>): AuthValue {
  return { ...DISABLED, ...over };
}

const SIGNED_IN = auth({ status: "signed_in", userId: "u1", address: "a@b.ch" });

function mount(value: AuthValue) {
  const view = render(
    <AuthContext.Provider value={value}>
      <BackupRunner />
    </AuthContext.Provider>,
  );
  return {
    ...view,
    set(next: AuthValue) {
      view.rerender(
        <AuthContext.Provider value={next}>
          <BackupRunner />
        </AuthContext.Provider>,
      );
    },
  };
}

const settle = () => act(() => vi.advanceTimersByTimeAsync(0));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  store.clear();
  localStorage.setItem("alltag.cards", JSON.stringify([CARD]));
  __resetBackupForTests();
  Object.assign(db.state, { log: [], upsertError: null, selectError: null });
  vi.mocked(withSession).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BackupRunner", () => {
  it("signed in: restore then backup, once", async () => {
    const view = mount(SIGNED_IN);
    await settle();
    expect(db.state.log).toEqual(["select", "upsert"]);
    expect(getBackupStatus().state).toBe("ok");
    view.unmount();
  });

  it("a store change backs up after 3000 ms", async () => {
    const view = mount(SIGNED_IN);
    await settle();
    db.state.log = [];
    act(() => {
      store.keep({ phrase_fr: "la table", phrase_en: "the table", noun_fr: "la table" });
    });
    await act(() => vi.advanceTimersByTimeAsync(2999));
    expect(db.state.log).toEqual([]);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(db.state.log).toEqual(["upsert"]);
    view.unmount();
  });

  it("online: restore then backup", async () => {
    const view = mount(SIGNED_IN);
    await settle();
    db.state.log = [];
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await settle();
    expect(db.state.log).toEqual(["select", "upsert"]);
    view.unmount();
  });

  it("retries after 60 s on error", async () => {
    db.state.upsertError = { message: "down" };
    const view = mount(SIGNED_IN);
    await settle();
    expect(getBackupStatus().state).toBe("error");
    db.state.log = [];
    db.state.upsertError = null;
    await act(() => vi.advanceTimersByTimeAsync(59_999));
    expect(db.state.log).toEqual([]);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(db.state.log).toEqual(["upsert"]);
    expect(getBackupStatus().state).toBe("ok");
    view.unmount();
  });

  it("retries the restore first when it failed", async () => {
    db.state.selectError = { message: "down" };
    const view = mount(SIGNED_IN);
    await settle();
    db.state.log = [];
    db.state.selectError = null;
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(db.state.log).toEqual(["select", "upsert"]);
    view.unmount();
  });

  it("signed out: no network", async () => {
    const view = mount(auth({ status: "signed_out" }));
    act(() => {
      store.keep({ phrase_fr: "la table", phrase_en: "the table", noun_fr: "la table" });
      window.dispatchEvent(new Event("online"));
    });
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(withSession).not.toHaveBeenCalled();
    expect(db.state.log).toEqual([]);
    expect(getBackupStatus().state).toBe("off");
    view.unmount();
  });

  it("unmount and sign out clean up and set status off", async () => {
    const view = mount(SIGNED_IN);
    await settle();
    expect(getBackupStatus().state).toBe("ok");
    view.set(auth({ status: "signed_out" }));
    expect(getBackupStatus().state).toBe("off");
    view.set(SIGNED_IN);
    await settle();
    view.unmount();
    expect(getBackupStatus().state).toBe("off");
    vi.mocked(withSession).mockClear();
    db.state.log = [];
    act(() => {
      store.keep({ phrase_fr: "la table", phrase_en: "the table", noun_fr: "la table" });
      window.dispatchEvent(new Event("online"));
    });
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(withSession).not.toHaveBeenCalled();
  });
});
