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
import TabBar, { useIsFullScreen } from "./components/TabBar";

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
  const fullScreen = useIsFullScreen();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {/* Roleplay has its own offline pill. */}
      {offline && screen !== "roleplay" && (
        <p
          role="status"
          className="glass-dark glass-specular fade-in mt-[max(8px,env(safe-area-inset-top))] flex h-9 items-center gap-2 self-center rounded-[18px] px-4 text-[13px] font-semibold leading-[18px] text-[color:var(--night-text)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8.5 6.6A6 6 0 0 1 18.1 10.05 4 4 0 0 1 20 17.2M17 18H7a4.5 4.5 0 0 1-1.3-8.8" />
            <path d="M3 3l18 18" />
          </svg>
          Offline · Noé on your phone
        </p>
      )}
      <main className="flex-1">
        <Current screen={screen} />
      </main>
      <TabBar screen={screen} go={go} hidden={fullScreen} />
    </div>
  );
}
