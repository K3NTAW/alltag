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
        <p role="status" className="border-b border-line bg-card px-[var(--gutter)] pt-[max(4px,env(safe-area-inset-top))] pb-1 text-[length:var(--text-small)] text-muted">
          offline. noé runs on this device.
        </p>
      )}
      <main className="flex-1">
        <Current screen={screen} />
      </main>
      <TabBar screen={screen} go={go} hidden={fullScreen} />
    </div>
  );
}
