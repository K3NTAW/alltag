import { useSyncExternalStore } from "react";

export type Screen =
  | "look"
  | "scene"
  | "roleplay"
  | "corrections"
  | "review"
  | "diary"
  | "listen"
  | "settings";

let current: Screen = "look";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Screen {
  return current;
}

export function go(screen: Screen): void {
  if (screen === current) return;
  current = screen;
  listeners.forEach((l) => l());
}

export function useScreen(): { screen: Screen; go: (s: Screen) => void } {
  const screen = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { screen, go };
}
