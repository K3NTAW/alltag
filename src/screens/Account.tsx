import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import GlassButton from "../components/GlassButton";
import Orb from "../components/Orb";
import { COPY, useAuth } from "../auth/auth";

type Mode = "sign_in" | "sign_up";

function validate(address: string, password: string): string | null {
  const at = address.indexOf("@");
  if (at < 1 || !address.slice(at + 1).includes(".") || address.endsWith(".")) return "enter your email address";
  if (password.length < 8) return COPY.weak;
  return null;
}

const field =
  "h-14 rounded-[var(--radius-inner)] bg-card px-4 text-[16px] leading-[23px] text-ink shadow-[var(--e1)] outline-none focus-visible:ring-2 focus-visible:ring-moss";
const label = "mx-1 font-mono text-[11px] leading-[14px] font-medium tracking-[0.08em] text-ink2 uppercase";
const primary =
  "press flex h-14 w-full items-center justify-center gap-2.5 rounded-[28px] bg-ink text-[17px] leading-[22px] font-semibold text-snow shadow-[0_8px_20px_rgba(18,19,22,0.18)] disabled:opacity-60";

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
      <div className="screen-enter pt-safe mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-[var(--gutter)] pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between pt-2">
          <Orb size={44} />
          <GlassButton aria-label="close" onClick={onClose}>
            <span aria-hidden className="text-[20px] leading-none">×</span>
          </GlassButton>
        </div>
        <h1 id="account-title" className="text-[40px] leading-[44px] tracking-[-0.01em] text-ink">
          Account
        </h1>

        {confirm ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="text-[16px] leading-[23px] text-ink2">
              {COPY.confirm}
            </p>
            <button
              type="button"
              onClick={() => {
                setConfirm(false);
                switchMode("sign_in");
              }}
              className={primary}
            >
              back to sign in
            </button>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="mode" className="grid h-10 grid-cols-2 rounded-[20px] bg-[var(--sunken)] p-0.5">
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
                  className={`press rounded-[18px] px-3 text-[15px] leading-[20px] font-semibold ${
                    mode === m
                      ? "bg-card text-ink shadow-[0_1px_2px_rgba(18,19,22,0.06),0_2px_8px_rgba(18,19,22,0.06)]"
                      : "text-ink2"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className={label}>address</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email username"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={field}
                />
              </label>
              <div className="flex flex-col gap-2">
                <label htmlFor="account-password" className={label}>
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
                    className="press min-w-14 rounded-[var(--radius-inner)] bg-card px-3 text-[13px] leading-[18px] font-semibold text-ink2 shadow-[var(--e1)]"
                  >
                    {show ? "hide" : "show"}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="mx-1 text-[13px] leading-[18px] text-clay">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className={`${primary} mt-2`}
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

        <button
          type="button"
          onClick={onClose}
          className="press h-11 self-center px-4 text-[15px] leading-[20px] font-semibold text-ink2"
        >
          not now
        </button>
        <p className="text-center text-[13px] leading-[18px] text-ink2">
          optional. without an account everything stays on this phone. your words sync to a server in Zurich (Supabase).
        </p>
      </div>
    </div>
  );
}
