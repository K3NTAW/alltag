import { useCallback, useEffect, useState } from "react";

export type Platform = "android" | "ios" | "other";

// Chrome's beforeinstallprompt event; not in lib.dom.
interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The slice of window the hook needs, so tests can pass a fake.
export interface InstallWindow {
  navigator: { userAgent: string; standalone?: boolean };
  matchMedia(query: string): { matches: boolean };
  addEventListener(type: string, cb: (e: Event) => void): void;
  removeEventListener(type: string, cb: (e: Event) => void): void;
}

export function detectPlatform(ua: string): Platform {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isStandalone(w: InstallWindow): boolean {
  // jsdom and old browsers have no matchMedia.
  const media = typeof w.matchMedia === "function" && w.matchMedia("(display-mode: standalone)").matches;
  return media || w.navigator.standalone === true;
}

export function useInstallPrompt(w: InstallWindow = window as unknown as InstallWindow) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone(w));
  const platform = detectPlatform(w.navigator.userAgent);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    }
    function onInstalled() {
      setDeferred(null);
      setInstalled(true);
    }
    w.addEventListener("beforeinstallprompt", onPrompt);
    w.addEventListener("appinstalled", onInstalled);
    return () => {
      w.removeEventListener("beforeinstallprompt", onPrompt);
      w.removeEventListener("appinstalled", onInstalled);
    };
  }, [w]);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    // The event can only be used once.
    setDeferred(null);
    if (choice?.outcome === "accepted") setInstalled(true);
  }, [deferred]);

  return { canInstall: deferred !== null && !installed, install, platform, installed };
}
