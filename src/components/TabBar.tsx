import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Screen } from "../lib/screen";

type Tab = "look" | "listen" | "review" | "diary" | "settings";

export const TABS: Tab[] = ["look", "listen", "review", "diary", "settings"];

// Night screens (camera, scene photo, roleplay, listen) get the dark bar.
const NIGHT: Screen[] = ["look", "scene", "roleplay", "listen"];

// Screens off the bar light up the tab they belong to.
function tabFor(screen: Screen): Tab {
  switch (screen) {
    case "scene":
    case "roleplay":
    case "corrections":
      return "look";
    default:
      return screen;
  }
}

const icons: Record<Tab, ReactNode> = {
  look: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h2l2-2h4l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  listen: (
    <>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </>
  ),
  review: (
    <>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  diary: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h9M19 6h1M4 12h1M11 12h9M4 18h9M19 18h1" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
};

// Full-screen states (roleplay live, listen live) hide the bar while they are mounted.
let fullScreen = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function bump(by: number) {
  fullScreen += by;
  listeners.forEach((l) => l());
}

export function useFullScreen(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    bump(1);
    return () => bump(-1);
  }, [active]);
}

export function useIsFullScreen(): boolean {
  return useSyncExternalStore(subscribe, () => fullScreen > 0, () => false);
}

interface Props {
  screen: Screen;
  go: (s: Screen) => void;
  hidden?: boolean;
}

export default function TabBar({ screen, go, hidden = false }: Props) {
  if (hidden) return null;
  const dark = NIGHT.includes(screen);
  const current = tabFor(screen);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + var(--tabbar-gap))" }}
    >
      <nav
        aria-label="main"
        data-variant={dark ? "dark" : "light"}
        className={`${dark ? "glass-dark" : "glass-light"} glass-specular pointer-events-auto flex h-[var(--tabbar-h)] items-center justify-around rounded-[var(--radius-capsule)] px-1`}
      >
        {TABS.map((t) => {
          const selected = t === current;
          return (
            <button
              key={t}
              type="button"
              onClick={() => go(t)}
              aria-current={selected ? "page" : undefined}
              className={`flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-[24px] ${
                selected ? "tint-moss" : dark ? "text-snow/72" : "text-ink2"
              }`}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {icons[t]}
              </svg>
              <span className="text-[11px] leading-[13px] font-semibold">{t}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
