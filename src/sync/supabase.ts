import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// One client for the whole app. Only the public URL and anon key reach the browser;
// RLS on auth.jwt() sub protects the rows.

let client: SupabaseClient | null = null;

function env(): { url: string; key: string } {
  return {
    url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "",
    key: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "",
  };
}

/** Reads the env at call time, so tests can stub it. */
export function isSupabaseConfigured(): boolean {
  const { url, key } = env();
  return Boolean(url && key);
}

/** The memoised client, or null when the build has no Supabase vars. */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const { url, key } = env();
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "alltag.auth",
    },
  });
  return client;
}

/**
 * The only door for sync. Reads the session stored on the device (it does not verify it online)
 * and calls fn with the client and the user id. Signed out, unconfigured or unreadable: null, no network.
 * A session that expires within 30 s is refreshed first; a failed refresh also gives null.
 * Errors thrown by fn propagate unchanged.
 */
export async function withSession<T>(fn: (client: SupabaseClient, userId: string) => Promise<T>): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  let userId: string;
  try {
    const { data } = await supabase.auth.getSession();
    let session = data.session;
    if (!session) return null;
    const expiresAt = session.expires_at;
    if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now() + 30_000) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session) return null;
      session = refreshed.data.session;
    }
    userId = session.user.id;
  } catch {
    return null;
  }
  return fn(supabase, userId);
}

export function __resetSupabaseForTests(): void {
  client = null;
}
