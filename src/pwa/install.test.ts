import { act, renderHook } from "@testing-library/react";
import { detectPlatform, useInstallPrompt, type InstallWindow } from "./install";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";

function fakeWindow(opts: { ua?: string; standalone?: boolean; iosStandalone?: boolean } = {}) {
  const target = new EventTarget();
  const w: InstallWindow = {
    navigator: { userAgent: opts.ua ?? ANDROID, standalone: opts.iosStandalone },
    matchMedia: (q) => ({ matches: q === "(display-mode: standalone)" && !!opts.standalone }),
    addEventListener: (t, cb) => target.addEventListener(t, cb),
    removeEventListener: (t, cb) => target.removeEventListener(t, cb),
  };
  return { w, fire: (e: Event) => target.dispatchEvent(e) };
}

function promptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  e.prompt = vi.fn(async () => undefined);
  e.userChoice = Promise.resolve({ outcome });
  return e;
}

describe("useInstallPrompt", () => {
  it("starts unable to install, not installed", () => {
    const { w } = fakeWindow();
    const { result } = renderHook(() => useInstallPrompt(w));
    expect(result.current.canInstall).toBe(false);
    expect(result.current.installed).toBe(false);
    expect(result.current.platform).toBe("android");
  });

  it("canInstall after beforeinstallprompt, install() calls prompt()", async () => {
    const { w, fire } = fakeWindow();
    const { result } = renderHook(() => useInstallPrompt(w));
    const e = promptEvent();
    act(() => {
      fire(e);
    });
    expect(e.defaultPrevented).toBe(true);
    expect(result.current.canInstall).toBe(true);
    await act(() => result.current.install());
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
    expect(result.current.installed).toBe(true);
  });

  it("dismissed prompt leaves it not installed", async () => {
    const { w, fire } = fakeWindow();
    const { result } = renderHook(() => useInstallPrompt(w));
    act(() => {
      fire(promptEvent("dismissed"));
    });
    await act(() => result.current.install());
    expect(result.current.installed).toBe(false);
    expect(result.current.canInstall).toBe(false);
  });

  it("installed in standalone mode", () => {
    const { w } = fakeWindow({ standalone: true });
    const { result } = renderHook(() => useInstallPrompt(w));
    expect(result.current.installed).toBe(true);
  });

  it("installed via navigator.standalone on iOS", () => {
    const { w } = fakeWindow({ ua: IPHONE, iosStandalone: true });
    const { result } = renderHook(() => useInstallPrompt(w));
    expect(result.current.installed).toBe(true);
  });

  it("appinstalled marks it installed", () => {
    const { w, fire } = fakeWindow();
    const { result } = renderHook(() => useInstallPrompt(w));
    act(() => {
      fire(new Event("appinstalled"));
    });
    expect(result.current.installed).toBe(true);
  });

  it("detects ios from the user agent", () => {
    const { w } = fakeWindow({ ua: IPHONE });
    const { result } = renderHook(() => useInstallPrompt(w));
    expect(result.current.platform).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("other");
  });
});
