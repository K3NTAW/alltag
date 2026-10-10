import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import GlassButton from "../components/GlassButton";
import { COPY, useAuth } from "../auth/auth";

type Mode = "sign_in" | "sign_up";

function validate(address: string, password: string): string | null {
  const at = address.indexOf("@");
  if (at < 1 || !address.slice(at + 1).includes(".") || address.endsWith(".")) return "enter your email address";
  if (password.length < 8) return COPY.weak;
  return null;
}

const field = "rounded-[var(--radius-button)] border border-line bg-card px-3 py-3 text-[length:var(--text-body)]";

/** Our own sign-in sheet. Full screen above the tab bar; Escape and "not now" close it. */
export default function Account({ onClose }: { onClose: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const mounted = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function switchMode(next: Mode) {
    if (pending) return;
    setMode(next);
    setPassword("");
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    const invalid = validate(address.trim(), password);
    if (invalid) {
      setError(invalid);
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    const run = mode === "sign_in" ? signIn : signUp;
    const result = await run(address.trim(), password);
    busy.current = false;
    if (!mounted.current) return;
    setPending(false);
    if (result.ok) {
      setPassword("");
      onClose();
      return;
    }
    if (result.needsConfirm) {
      setPassword("");
      setConfirm(true);
      return;
    }
    if (result.existing) {
      setMode("sign_in");
      setPassword("");
    }
    setError(result.error ?? COPY.generic);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-title"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 overflow-y-auto bg-paper"
    >
      <div className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-[var(--gutter)] pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="flex justify-end pt-2">
          <GlassButton aria-label="close" onClick={onClose}>
            <span aria-hidden className="text-[20px] leading-none">×</span>
          </GlassButton>
        </div>
        <h1 id="account-title" className="text-[length:var(--text-h1)] leading-[var(--lh-h1)] font-bold">
          account
        </h1>

        {confirm ? (
          <div className="flex flex-col gap-4">
            <p role="status">{COPY.confirm}</p>
            <button
              type="button"
              onClick={() => {
                setConfirm(false);
                switchMode("sign_in");
              }}
              className="self-start rounded-[var(--radius-pill)] bg-moss px-6 py-3 font-semibold text-snow"
            >
              back to sign in
            </button>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="mode" className="flex rounded-[var(--radius-pill)] border border-line bg-card p-1">
              {(
                [
                  ["sign_in", "sign in"],
                  ["sign_up", "create account"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 rounded-[var(--radius-pill)] px-3 py-2 text-[length:var(--text-callout)] ${
                    mode === m ? "bg-moss-soft font-semibold text-moss" : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-muted">address</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email username"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={field}
                />
              </label>
              <div className="flex flex-col gap-1">
                <label htmlFor="account-password" className="text-muted">
                  password
                </label>
                <div className="flex gap-2">
                  <input
                    id="account-password"
                    type={show ? "text" : "password"}
                    name="password"
                    autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${field} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    aria-label={show ? "hide password" : "show password"}
                    onClick={() => setShow((s) => !s)}
                    className="rounded-[var(--radius-button)] border border-line bg-card px-3 text-[length:var(--text-small)] text-muted"
                  >
                    {show ? "hide" : "show"}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="text-[length:var(--text-small)] text-[var(--clay)]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="mt-2 flex items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-moss px-6 py-3 font-semibold text-snow disabled:opacity-60"
              >
                {pending && (
                  <span
                    aria-hidden
                    className="h-4 w-4 rounded-[var(--radius-pill)] border-2 border-snow/40 border-t-snow motion-safe:animate-spin"
                  />
                )}
                {mode === "sign_in" ? "sign in" : "create account"}
              </button>
            </form>
          </>
        )}

        <button type="button" onClick={onClose} className="self-center px-4 py-2 text-muted">
          not now
        </button>
        <p className="text-[length:var(--text-small)] text-muted">
          optional. without an account everything stays on this phone. your words sync to a server in Zurich (Supabase).
        </p>
      </div>
    </div>
  );
}
