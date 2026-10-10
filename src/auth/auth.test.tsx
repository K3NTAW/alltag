import { StrictMode, useEffect } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { __resetSupabaseForTests } from "../sync/supabase";
import { AuthProvider, COPY, authErrorCopy, useAuth, type AuthValue } from "./auth";

type Listener = (event: string, session: unknown) => void;

const sb = vi.hoisted(() => {
  const listeners = new Set<Listener>();
  const auth = {
    onAuthStateChange: vi.fn((cb: Listener) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: vi.fn(() => listeners.delete(cb)) } } };
    }),
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  };
  return {
    listeners,
    auth,
    emit(event: string, session: unknown) {
      listeners.forEach((l) => l(event, session));
    },
    createClient: vi.fn(() => ({ auth })),
  };
});

vi.mock("@supabase/supabase-js", async () => ({
  ...(await vi.importActual<typeof import("@supabase/supabase-js")>("@supabase/supabase-js")),
  createClient: sb.createClient,
}));

const session = { user: { id: "u1", email: "a@b.ch" }, expires_at: 9999999999 };

let ctx: AuthValue;
function Probe() {
  const value = useAuth();
  useEffect(() => {
    ctx = value;
  });
  return (
    <p data-testid="status">
      {value.status} {value.userId ?? "-"} {value.address ?? "-"}
    </p>
  );
}

function configure() {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
}

const status = () => screen.getByTestId("status").textContent;

beforeEach(() => {
  __resetSupabaseForTests();
  sb.listeners.clear();
  sb.createClient.mockClear();
  Object.values(sb.auth).forEach((f) => f.mockClear());
  sb.auth.getSession.mockReset();
  sb.auth.signInWithPassword.mockReset();
  sb.auth.signUp.mockReset();
  sb.auth.signOut.mockReset();
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("AuthProvider status", () => {
  it("disabled without env, no client", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(status()).toBe("disabled - -");
    expect(await ctx.signIn("a@b.ch", "12345678")).toEqual({ ok: false, error: "off" });
    expect(sb.createClient).not.toHaveBeenCalled();
  });

  it("loading until INITIAL_SESSION, then signed_in; sign-out event flips to signed_out", () => {
    configure();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(status()).toBe("loading - -");
    expect(sb.auth.getSession).not.toHaveBeenCalled();
    act(() => sb.emit("INITIAL_SESSION", session));
    expect(status()).toBe("signed_in u1 a@b.ch");
    act(() => sb.emit("SIGNED_OUT", null));
    expect(status()).toBe("signed_out - -");
  });

  it("INITIAL_SESSION without a session is signed_out", () => {
    configure();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    act(() => sb.emit("INITIAL_SESSION", null));
    expect(status()).toBe("signed_out - -");
  });

  it("unsubscribes on unmount", () => {
    configure();
    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(sb.listeners.size).toBe(1);
    unmount();
    expect(sb.listeners.size).toBe(0);
  });

  it("StrictMode mount/unmount/mount leaves exactly one subscription", () => {
    configure();
    render(
      <StrictMode>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </StrictMode>,
    );
    expect(sb.auth.onAuthStateChange).toHaveBeenCalledTimes(2);
    expect(sb.listeners.size).toBe(1);
    act(() => sb.emit("INITIAL_SESSION", session));
    expect(status()).toBe("signed_in u1 a@b.ch");
  });

  it("falls back to getSession after 4 s without an event", async () => {
    vi.useFakeTimers();
    configure();
    sb.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => vi.advanceTimersByTimeAsync(3999));
    expect(sb.auth.getSession).not.toHaveBeenCalled();
    expect(status()).toBe("loading - -");
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(sb.auth.getSession).toHaveBeenCalledTimes(1);
    expect(status()).toBe("signed_in u1 a@b.ch");
    act(() => sb.emit("SIGNED_OUT", null));
    expect(status()).toBe("signed_out - -");
  });

  it("fallback: getSession hanging past 3 s gives signed_out", async () => {
    vi.useFakeTimers();
    configure();
    sb.auth.getSession.mockReturnValue(new Promise(() => {}));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => vi.advanceTimersByTimeAsync(4000));
    expect(status()).toBe("loading - -");
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(status()).toBe("signed_out - -");
  });

  it("fallback: getSession throwing gives signed_out", async () => {
    vi.useFakeTimers();
    configure();
    sb.auth.getSession.mockRejectedValue(new Error("storage"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => vi.advanceTimersByTimeAsync(4000));
    expect(status()).toBe("signed_out - -");
  });

  it("no fallback once an event arrived", async () => {
    vi.useFakeTimers();
    configure();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    act(() => sb.emit("INITIAL_SESSION", null));
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(sb.auth.getSession).not.toHaveBeenCalled();
  });
});

describe("signIn and signUp", () => {
  function mount() {
    configure();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    act(() => sb.emit("INITIAL_SESSION", null));
  }

  it("signIn ok; status flips only from the SIGNED_IN event", async () => {
    mount();
    sb.auth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
    let result;
    await act(async () => {
      result = await ctx.signIn("a@b.ch", "12345678");
    });
    expect(sb.auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.ch", password: "12345678" });
    expect(result).toEqual({ ok: true, error: null });
    expect(status()).toBe("signed_out - -");
    act(() => sb.emit("SIGNED_IN", session));
    expect(status()).toBe("signed_in u1 a@b.ch");
  });

  it("signIn maps invalid_credentials", async () => {
    mount();
    sb.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    let result;
    await act(async () => {
      result = await ctx.signIn("a@b.ch", "12345678");
    });
    expect(result).toEqual({ ok: false, error: COPY.invalid });
    expect(ctx.error).toBe(COPY.invalid);
    act(() => ctx.resetError());
    expect(ctx.error).toBeNull();
  });

  it("signIn: a thrown fetch failure maps to the offline copy", async () => {
    mount();
    sb.auth.signInWithPassword.mockRejectedValue(new AuthRetryableFetchError("Failed to fetch", 0));
    let result;
    await act(async () => {
      result = await ctx.signIn("a@b.ch", "12345678");
    });
    expect(result).toEqual({ ok: false, error: COPY.offline });
  });

  it("signUp with a session is ok", async () => {
    mount();
    sb.auth.signUp.mockResolvedValue({ data: { user: session.user, session }, error: null });
    let result;
    await act(async () => {
      result = await ctx.signUp("a@b.ch", "12345678");
    });
    expect(sb.auth.signUp).toHaveBeenCalledWith({ email: "a@b.ch", password: "12345678" });
    expect(result).toEqual({ ok: true, error: null });
  });

  it("signUp without a session needs confirming", async () => {
    mount();
    sb.auth.signUp.mockResolvedValue({ data: { user: { ...session.user, identities: [{}] }, session: null }, error: null });
    let result;
    await act(async () => {
      result = await ctx.signUp("a@b.ch", "12345678");
    });
    expect(result).toEqual({ ok: false, needsConfirm: true, error: COPY.confirm });
  });

  it("signUp with empty identities gives the neutral confirm copy", async () => {
    mount();
    sb.auth.signUp.mockResolvedValue({ data: { user: { ...session.user, identities: [] }, session: null }, error: null });
    let result;
    await act(async () => {
      result = await ctx.signUp("a@b.ch", "12345678");
    });
    expect(result).toEqual({ ok: false, needsConfirm: true, error: COPY.confirm });
  });

  it("signUp with an existing address says sign in instead", async () => {
    mount();
    for (const code of ["user_already_exists", "email_exists"]) {
      sb.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new AuthApiError("User already registered", 422, code),
      });
      let result;
      await act(async () => {
        result = await ctx.signUp("a@b.ch", "12345678");
      });
      expect(result).toEqual({ ok: false, existing: true, error: COPY.existing });
    }
  });

  it("signOut calls supabase", async () => {
    mount();
    sb.auth.signOut.mockResolvedValue({ error: null });
    await act(async () => {
      await ctx.signOut();
    });
    expect(sb.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("openAccount shows the sheet; an ok sign in closes it", async () => {
    mount();
    sb.auth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
    act(() => ctx.openAccount());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("address"), { target: { value: "a@b.ch" } });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "12345678" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "sign in" }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("authErrorCopy", () => {
  it("maps by code", () => {
    expect(authErrorCopy(new AuthApiError("x", 400, "invalid_credentials"))).toBe(COPY.invalid);
    expect(authErrorCopy(new AuthApiError("x", 422, "user_already_exists"))).toBe(
      "there is already an account for this address. sign in instead.",
    );
    expect(authErrorCopy(new AuthApiError("x", 422, "email_exists"))).toBe(COPY.existing);
    expect(authErrorCopy(new AuthApiError("x", 422, "weak_password"))).toBe(COPY.weak);
    expect(authErrorCopy(new AuthRetryableFetchError("Failed to fetch", 503))).toBe(COPY.offline);
    expect(authErrorCopy(new AuthApiError("x", 0, "unexpected_failure"))).toBe(COPY.offline);
    expect(authErrorCopy(new AuthApiError("x", 500, "unexpected_failure"))).toBe(COPY.generic);
    expect(authErrorCopy(new Error("boom"))).toBe(COPY.generic);
    expect(authErrorCopy(null)).toBe(COPY.generic);
  });

  it("codes win over the offline check", () => {
    expect(authErrorCopy(new AuthApiError("x", 0, "weak_password"))).toBe(COPY.weak);
  });
});
