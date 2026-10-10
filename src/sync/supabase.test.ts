import { __resetSupabaseForTests, getSupabase, isSupabaseConfigured, withSession } from "./supabase";

const sb = vi.hoisted(() => {
  const auth = {
    getSession: vi.fn(),
    refreshSession: vi.fn(),
  };
  return { auth, createClient: vi.fn(() => ({ auth })) };
});

vi.mock("@supabase/supabase-js", async () => ({
  ...(await vi.importActual<typeof import("@supabase/supabase-js")>("@supabase/supabase-js")),
  createClient: sb.createClient,
}));

const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;

function configure() {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
}

describe("supabase client", () => {
  beforeEach(() => {
    __resetSupabaseForTests();
    sb.createClient.mockClear();
    sb.auth.getSession.mockReset();
    sb.auth.refreshSession.mockReset();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("is null when unconfigured, env read at call time", () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabase()).toBeNull();
    expect(sb.createClient).not.toHaveBeenCalled();
    configure();
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabase()).not.toBeNull();
  });

  it("makes one client with the auth options", () => {
    configure();
    const a = getSupabase();
    const b = getSupabase();
    expect(a).toBe(b);
    expect(sb.createClient).toHaveBeenCalledTimes(1);
    expect(sb.createClient).toHaveBeenCalledWith("https://example.supabase.co", "anon", {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "alltag.auth" },
    });
  });

  it("withSession: null without config, no client", async () => {
    const fn = vi.fn();
    expect(await withSession(fn)).toBeNull();
    expect(fn).not.toHaveBeenCalled();
    expect(sb.createClient).not.toHaveBeenCalled();
  });

  it("withSession: null without a session", async () => {
    configure();
    sb.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const fn = vi.fn();
    expect(await withSession(fn)).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("withSession: null when getSession throws", async () => {
    configure();
    sb.auth.getSession.mockRejectedValue(new Error("storage"));
    const fn = vi.fn();
    expect(await withSession(fn)).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("withSession: passes the client and user id", async () => {
    configure();
    sb.auth.getSession.mockResolvedValue({ data: { session: { expires_at: inAnHour(), user: { id: "u1" } } }, error: null });
    const fn = vi.fn(async (_c: unknown, id: string) => `ok ${id}`);
    expect(await withSession(fn)).toBe("ok u1");
    expect(fn).toHaveBeenCalledWith(getSupabase(), "u1");
    expect(sb.auth.refreshSession).not.toHaveBeenCalled();
  });

  it("withSession: errors from fn propagate", async () => {
    configure();
    sb.auth.getSession.mockResolvedValue({ data: { session: { expires_at: inAnHour(), user: { id: "u1" } } }, error: null });
    await expect(withSession(async () => Promise.reject(new Error("push failed")))).rejects.toThrow("push failed");
  });

  it("withSession: refreshes an expiring session and uses the new one", async () => {
    configure();
    const soon = Math.floor(Date.now() / 1000) + 10;
    sb.auth.getSession.mockResolvedValue({ data: { session: { expires_at: soon, user: { id: "old" } } }, error: null });
    sb.auth.refreshSession.mockResolvedValue({
      data: { session: { expires_at: inAnHour(), user: { id: "u2" } } },
      error: null,
    });
    const fn = vi.fn(async () => "ok");
    expect(await withSession(fn)).toBe("ok");
    expect(sb.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(expect.anything(), "u2");
  });

  it("withSession: missing expires_at counts as expiring", async () => {
    configure();
    sb.auth.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null });
    sb.auth.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
    const fn = vi.fn();
    expect(await withSession(fn)).toBeNull();
    expect(sb.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("withSession: null when the refresh fails", async () => {
    configure();
    sb.auth.getSession.mockResolvedValue({ data: { session: { expires_at: 1, user: { id: "u1" } } }, error: null });
    sb.auth.refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "expired" } });
    const fn = vi.fn();
    expect(await withSession(fn)).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
