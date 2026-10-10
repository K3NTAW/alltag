import { useSyncExternalStore } from "react";
import { useScreen, type Screen } from "./lib/screen";
import Look from "./screens/Look";
import SceneScreen from "./screens/Scene";
import Roleplay from "./screens/Roleplay";
import Corrections from "./screens/Corrections";
import Review from "./screens/Review";
import Diary from "./screens/Diary";
import Settings from "./screens/Settings";

const nav: Screen[] = ["look", "review", "diary", "settings"];

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
            className={`flex-1 py-3 text-sm ${screen === s ? "text-accent" : "text-muted"}`}
          >
            {s}
          </button>
        ))}
      </nav>
    </div>
  );
}
