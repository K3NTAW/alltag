import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { postScene } from "../lib/api";
import { go } from "../lib/screen";
import { session } from "../lib/session";
import { getSettings } from "../lib/settings";
import { captureJpeg, fileToJpeg, startCamera, stopCamera } from "../camera/capture";
import * as store from "../srs/store";
import Viewfinder from "../camera/Viewfinder";
import Orb from "../components/Orb";

type Phase = "idle" | "scanning";

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export default function Look() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"pending" | "on" | "off">("pending");
  const [phase, setPhase] = useState<Phase>("idle");
  const [frame, setFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const offline = useSyncExternalStore(subscribeOnline, () => !navigator.onLine);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;
    startCamera(video)
      .then((s) => {
        if (cancelled) {
          stopCamera(s);
          return;
        }
        stream = s;
        setCamera("on");
      })
      .catch(() => {
        if (!cancelled) setCamera("off");
      });
    return () => {
      cancelled = true;
      stopCamera(stream);
    };
  }, []);

  async function read(image: string) {
    session.frame = image;
    setFrame(image);
    setPhase("scanning");
    setError(null);
    try {
      const scene = await postScene({
        imageBase64: image,
        level: getSettings().level,
        knownWords: store.all().map((c) => c.noun_fr ?? c.phrase_fr),
      });
      session.scene = scene;
      go("scene");
    } catch {
      setPhase("idle");
      setFrame(null);
      setError("could not read that. try again.");
    }
  }

  function look() {
    const video = videoRef.current;
    if (!video || phase === "scanning") return;
    let image: string;
    try {
      image = captureJpeg(video);
    } catch {
      setError("no picture yet. try again.");
      return;
    }
    void read(image);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      void read(await fileToJpeg(file, 1024));
    } catch {
      setError("could not open that picture. try again.");
    }
  }

  const scanning = phase === "scanning";

  const shutter = (
    <span aria-hidden className="flex h-[78px] w-[78px] items-center justify-center rounded-full border-4 border-snow">
      <span className="h-[62px] w-[62px] rounded-full bg-snow" />
    </span>
  );

  return (
    <section className="bg-night relative flex min-h-dvh flex-col overflow-hidden text-[var(--night-text)]">
      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="viewfinder"
        className={`absolute inset-0 h-full w-full object-cover ${camera === "on" && !frame ? "" : "hidden"}`}
      />
      {frame && <img src={frame} alt="" className="fade-in absolute inset-0 h-full w-full object-cover" />}
      {/* Dims only where glass floats; a light night veil while scanning. */}
      {scanning && <div aria-hidden className="pointer-events-none absolute inset-0 bg-night/25" />}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[140px] bg-gradient-to-b from-[var(--camera-dim)] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] bg-gradient-to-t from-[var(--camera-dim)] to-transparent" />

      <header className="pt-safe relative z-10 flex justify-center px-5">
        <p className="glass-dark glass-specular flex h-9 items-center rounded-full px-4 text-[13px] font-semibold">
          Français · {getSettings().level}
        </p>
      </header>

      <Viewfinder scanning={scanning} />

      {scanning ? (
        <div className="sheet-up absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 rounded-t-[var(--radius-sheet)] border-t border-[var(--glass-dark-border)] bg-[var(--raised)] px-5 pt-6 pb-tabbar">
          <Orb size={44} state="thinking" className="absolute top-5 right-5 text-[var(--night-text2)]" />
          <p className="font-mono text-[11px] leading-[14px] font-medium tracking-[0.08em] text-[var(--sun-on-dark)] uppercase">Looking</p>
          <p lang="fr" className="font-display text-[24px] leading-[30px]">
            Un instant…
          </p>
          <p className="text-[13px] leading-[18px] text-[var(--night-text2)]">Finding what is around you</p>
          <div aria-hidden className="mt-3 flex gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-8 w-[90px] animate-[shimmer_1.6s_linear_infinite] rounded-full bg-[linear-gradient(90deg,var(--glass-clear-bg),var(--glass-clear-border),var(--glass-clear-bg))] bg-[length:200%_100%]"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="pb-tabbar relative z-10 mt-auto flex flex-col items-center gap-4 px-5">
          {!offline && (
            <div className="rise-in flex flex-col items-center gap-1 text-center">
              <p lang="fr" className="font-display text-[19px] leading-[25px]">
                Point at anything.
              </p>
              <p className="text-[13px] leading-[18px] text-[var(--night-text2)]">Noé tells you what it is called.</p>
            </div>
          )}
          {camera === "off" ? (
            <label className="press flex cursor-pointer items-center justify-center rounded-full">
              {shutter}
              <span className="sr-only">look</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="look"
                className="sr-only"
                onChange={onFile}
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={look}
              disabled={camera !== "on"}
              className="press flex cursor-pointer items-center justify-center rounded-full disabled:opacity-50"
            >
              {shutter}
              <span className="sr-only">look</span>
            </button>
          )}
          {offline && (
            <div className="rise-in flex flex-col items-center gap-2 text-center">
              <p className="text-[13px] leading-[18px] text-[var(--night-text2)]">
                camera needs the network. your kept phrases and saved scenes work offline.
              </p>
              <button
                type="button"
                onClick={() => go("diary")}
                className="glass-dark glass-specular press flex h-11 items-center rounded-full px-5 text-[15px] font-semibold"
              >
                open a saved scene
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-[15px] leading-[21px] text-[var(--sun-on-dark)]">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
