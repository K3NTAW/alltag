import { useSyncExternalStore } from "react";
import { useScreen, type Screen } from "./lib/screen";
import Look from "./screens/Look";
import SceneScreen from "./screens/Scene";
import Roleplay from "./screens/Roleplay";
import Corrections from "./screens/Corrections";
import Review from "./screens/Review";
import Diary from "./screens/Diary";
import Listen from "./screens/Listen";
import Settings from "./screens/Settings";

const nav: Screen[] = ["look", "listen", "review", "diary", "settings"];

function WaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2" />
    </svg>
  );
}

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function Current({ screen }: { screen: Screen }) {
  switch (screen) {
    case "look":
      return <Look />;
    case "scene":
      return <SceneScreen />;
    case "roleplay":
      return <Roleplay />;
    case "corrections":
      return <Corrections />;
    case "review":
      return <Review />;
    case "diary":
      return <Diary />;
    case "settings":
      return <Settings />;
    case "listen":
      return <Listen />;
  }
}

export default function App() {
  const { screen, go } = useScreen();
  const offline = useSyncExternalStore(subscribeOnline, () => !navigator.onLine);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {/* Roleplay has its own offline pill. */}
      {offline && screen !== "roleplay" && (
        <p role="status" className="border-b border-line bg-card px-[var(--gutter)] py-1 text-[length:var(--text-small)] text-muted">
          offline. noé runs on this device.
        </p>
      )}
      <main className="flex-1">
        <Current screen={screen} />
      </main>
      <nav className="sticky bottom-0 flex justify-around border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
        {nav.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go(s)}
            aria-current={screen === s ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-1 py-3 text-sm ${screen === s ? "text-accent" : "text-muted"}`}
          >
            {s === "listen" && <WaveIcon />}
            {s}
          </button>
        ))}
      </nav>
    </div>
  );
}
