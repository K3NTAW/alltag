import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAuthRetryableFetchError, type Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "../sync/supabase";
import Account from "../screens/Account";

export type AuthStatus = "disabled" | "loading" | "signed_out" | "signed_in";

export interface AuthResult {
  ok: boolean;
  /** Sign-up went through but the address must be confirmed first. */
  needsConfirm?: boolean;
  /** Sign-up hit an existing account; Account switches to sign in. */
  existing?: boolean;
  error: string | null;
}

export interface AuthValue {
  status: AuthStatus;
  userId: string | null;
  address: string | null;
  error: string | null;
  signIn: (address: string, password: string) => Promise<AuthResult>;
  signUp: (address: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  resetError: () => void;
  openAccount: () => void;
  closeAccount: () => void;
}

export const COPY = {
  invalid: "that address and password don't match",
  existing: "there is already an account for this address. sign in instead.",
  confirm: "check your inbox to confirm your address, then sign in here.",
  weak: "use at least 8 characters",
  offline: "no connection, try again when you are online",
  generic: "something went wrong, try again",
} as const;

const off = async (): Promise<AuthResult> => ({ ok: false, error: "off" });
const noop = () => {};

export const DISABLED: AuthValue = {
  status: "disabled",
  userId: null,
  address: null,
  error: null,
  signIn: off,
  signUp: off,
  signOut: off,
  resetError: noop,
  openAccount: noop,
  closeAccount: noop,
};

export const AuthContext = createContext<AuthValue>(DISABLED);

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}

/** Calm copy for an auth error. Codes first, then the offline check, then the generic line. */
export function authErrorCopy(error: unknown): string {
  const e = (error ?? {}) as { code?: unknown; status?: unknown };
  if (e.code === "invalid_credentials") return COPY.invalid;
  if (e.code === "user_already_exists" || e.code === "email_exists") return COPY.existing;
  if (e.code === "weak_password") return COPY.weak;
  if (isAuthRetryableFetchError(error) || e.status === 0) return COPY.offline;
  return COPY.generic;
}

function isExisting(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "user_already_exists" || code === "email_exists";
}

interface SessionState {
  status: Exclude<AuthStatus, "disabled">;
  userId: string | null;
  address: string | null;
}

function fromSession(session: Session | null): SessionState {
  return session
    ? { status: "signed_in", userId: session.user.id, address: session.user.email ?? null }
    : { status: "signed_out", userId: null, address: null };
}

const FALLBACK_MS = 4000;
const FALLBACK_TIMEOUT_MS = 3000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [configured] = useState(isSupabaseConfigured);
  const [state, setState] = useState<SessionState>({ status: "loading", userId: null, address: null });
  const [error, setError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const client = getSupabase();
    if (!client) return;
    let live = true;
    let heard = false;
    // supabase-js emits INITIAL_SESSION on subscribe. Keep this callback synchronous:
    // awaiting or calling supabase in here deadlocks the auth lock.
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!live) return;
      heard = true;
      setState(fromSession(session));
    });
    // No event within 4 s: read the stored session once, bounded by its own timeout.
    const timer = setTimeout(() => {
      if (heard) return;
      let bound: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        bound = setTimeout(() => reject(new Error("timeout")), FALLBACK_TIMEOUT_MS);
      });
      Promise.race([client.auth.getSession(), timeout])
        .then(({ data: d }) => {
          if (live && !heard) setState(fromSession(d.session));
        })
        .catch(() => {
          if (live && !heard) setState(fromSession(null));
        })
        .finally(() => clearTimeout(bound));
    }, FALLBACK_MS);
    return () => {
      live = false;
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [configured]);

  const signIn = useCallback(async (address: string, password: string): Promise<AuthResult> => {
    const client = getSupabase();
    if (!client) return { ok: false, error: "off" };
    try {
      const { error: e } = await client.auth.signInWithPassword({ email: address, password });
      if (e) {
        const copy = authErrorCopy(e);
        setError(copy);
        return { ok: false, error: copy };
      }
      setError(null);
      return { ok: true, error: null };
    } catch (e) {
      const copy = authErrorCopy(e);
      setError(copy);
      return { ok: false, error: copy };
    }
  }, []);

  const signUp = useCallback(async (address: string, password: string): Promise<AuthResult> => {
    const client = getSupabase();
    if (!client) return { ok: false, error: "off" };
    try {
      const { data, error: e } = await client.auth.signUp({ email: address, password });
      if (e) {
        const copy = authErrorCopy(e);
        setError(copy);
        return { ok: false, existing: isExisting(e), error: copy };
      }
      setError(null);
      if (data.session) return { ok: true, error: null };
      // No session: the project wants the address confirmed. Empty identities means the address
      // is taken while confirmation is on; same neutral copy so nobody learns which addresses exist.
      if (data.user) return { ok: false, needsConfirm: true, error: COPY.confirm };
      setError(COPY.generic);
      return { ok: false, error: COPY.generic };
    } catch (e) {
      const copy = authErrorCopy(e);
      setError(copy);
      return { ok: false, error: copy };
    }
  }, []);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    const client = getSupabase();
    if (!client) return { ok: false, error: "off" };
    try {
      const { error: e } = await client.auth.signOut();
      if (e) return { ok: false, error: authErrorCopy(e) };
      return { ok: true, error: null };
    } catch (e) {
      return { ok: false, error: authErrorCopy(e) };
    }
  }, []);

  const resetError = useCallback(() => setError(null), []);
  const openAccount = useCallback(() => setAccountOpen(true), []);
  const closeAccount = useCallback(() => {
    setAccountOpen(false);
    setError(null);
  }, []);

  const value = useMemo<AuthValue>(
    () =>
      configured
        ? { ...state, error, signIn, signUp, signOut, resetError, openAccount, closeAccount }
        : DISABLED,
    [configured, state, error, signIn, signUp, signOut, resetError, openAccount, closeAccount],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {configured && accountOpen && <Account onClose={closeAccount} />}
    </AuthContext.Provider>
  );
}
