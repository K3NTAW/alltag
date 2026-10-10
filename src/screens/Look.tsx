import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { postScene } from "../lib/api";
import { go } from "../lib/screen";
import { session } from "../lib/session";
import { getSettings } from "../lib/settings";
import { captureJpeg, fileToJpeg, startCamera, stopCamera } from "../camera/capture";
import * as store from "../srs/store";

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

  return (
    <section className="bg-night relative flex min-h-dvh flex-col text-snow">
      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="viewfinder"
        className={`absolute inset-0 h-full w-full object-cover ${camera === "on" && !frame ? "" : "hidden"}`}
      />
      {frame && (
        <img src={frame} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      )}
      {/* 35 % dim only where the clear glass floats. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-[var(--camera-dim)] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[160px] bg-gradient-to-t from-[var(--camera-dim)] to-transparent" />

      <div className="pb-tabbar relative mt-auto flex flex-col items-center gap-3 px-6 pt-6">
        {scanning ? (
          <p className="animate-pulse text-[length:var(--text-m)]">reading the room</p>
        ) : camera === "off" ? (
          <label className="glass-clear glass-specular flex h-[88px] w-[88px] items-center justify-center rounded-[var(--radius-pill)] border-2 border-snow/60 text-[length:var(--text-m)] font-semibold cursor-pointer">
            look
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
            className="glass-clear glass-specular flex h-[88px] w-[88px] items-center justify-center rounded-[var(--radius-pill)] border-2 border-snow/60 text-[length:var(--text-m)] font-semibold disabled:opacity-50"
          >
            look
          </button>
        )}
        {!scanning && offline ? (
          <>
            <p className="text-[length:var(--text-xs)] opacity-70">
              camera needs the network. your kept phrases and saved scenes work offline.
            </p>
            <button
              type="button"
              onClick={() => go("diary")}
              className="glass-clear glass-specular flex h-9 items-center rounded-[18px] px-4 text-[15px] font-semibold"
            >
              open a saved scene
            </button>
          </>
        ) : (
          !scanning && <p className="text-[length:var(--text-xs)] opacity-70">point at anything</p>
        )}
        {error && (
          <p role="alert" className="text-[length:var(--text-s)] text-due">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
