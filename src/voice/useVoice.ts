import { useCallback, useEffect, useRef, useState } from "react";
import { getGradiumToken } from "../lib/api";
import { getSettings } from "../lib/settings";
import { workletUrl } from "./pcm-worklet";
import { SttSession } from "./stt";
import { TtsPlayer } from "./tts";

const FLUSH_TIMEOUT_MS = 3000;

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

interface UseVoiceOptions {
  onFinal: (text: string) => void;
  onPartial?: (text: string) => void;
}

interface Capture {
  ctx: AudioContext;
  stream: MediaStream;
  node: AudioWorkletNode;
  url: string;
}

function audioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext;
}

export function useVoice(opts: UseVoiceOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [partial, setPartial] = useState("");
  const optsRef = useRef(opts);
  const sttRef = useRef<SttSession | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const ttsRef = useRef<TtsPlayer | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const genRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    optsRef.current = opts;
  });

  const teardownCapture = useCallback(() => {
    sttRef.current?.close();
    sttRef.current = null;
    const cap = captureRef.current;
    captureRef.current = null;
    if (!cap) return;
    cap.node.port.onmessage = null;
    cap.node.disconnect();
    cap.stream.getTracks().forEach((t) => t.stop());
    URL.revokeObjectURL(cap.url);
    void cap.ctx.close().catch(() => undefined);
  }, []);

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current !== null) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }, []);

  // Create or resume the playback context synchronously, inside the user gesture, so Safari/iOS allow audio.
  const primePlayback = useCallback((): AudioContext | undefined => {
    const Ctx = audioContextCtor();
    if (Ctx && !playCtxRef.current) playCtxRef.current = new Ctx();
    const ctx = playCtxRef.current ?? undefined;
    if (ctx?.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  }, []);

  const startListening = useCallback(async () => {
    const gen = ++genRef.current;
    const stale = () => genRef.current !== gen;
    clearStopTimer();
    teardownCapture();
    ttsRef.current?.stop();
    ttsRef.current = null;
    primePlayback();
    setPartial("");
    setState("listening");
    try {
      const { token } = await getGradiumToken();
      if (stale()) return;
      const stt = new SttSession({
        token,
        language: getSettings().language,
        onPartial: (text) => {
          if (stale()) return;
          setPartial(text);
          optsRef.current.onPartial?.(text);
        },
        onFinal: (text) => {
          if (stale()) return;
          clearStopTimer();
          teardownCapture();
          setPartial(text);
          setState("thinking");
          optsRef.current.onFinal(text);
        },
        onEmpty: () => {
          if (stale()) return;
          clearStopTimer();
          teardownCapture();
          setState("idle");
        },
      });
      sttRef.current = stt;
      stt.open();

      const Ctx = audioContextCtor();
      const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
      if (!Ctx || !media?.getUserMedia || typeof AudioWorkletNode === "undefined") return;
      const stream = await media.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      if (stale()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = new Ctx();
      const url = workletUrl();
      let ready = false;
      try {
        await ctx.audioWorklet.addModule(url);
        ready = !stale();
      } finally {
        if (!ready) {
          stream.getTracks().forEach((t) => t.stop());
          URL.revokeObjectURL(url);
          void ctx.close().catch(() => undefined);
        }
      }
      if (!ready) return;
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pcm-capture");
      node.port.onmessage = (ev: MessageEvent<Float32Array>) => stt.pushSamples(ev.data, ctx.sampleRate);
      source.connect(node);
      captureRef.current = { ctx, stream, node, url };
    } catch {
      if (stale()) return;
      teardownCapture();
      setState("idle");
    }
  }, [teardownCapture, clearStopTimer, primePlayback]);

  const stopListening = useCallback(() => {
    const stt = sttRef.current;
    if (!stt) return;
    const gen = genRef.current;
    stt.flush();
    clearStopTimer();
    // If the server never answers the flush, stop waiting and go idle.
    stopTimerRef.current = setTimeout(() => {
      stopTimerRef.current = null;
      if (genRef.current !== gen || sttRef.current !== stt) return;
      teardownCapture();
      setState("idle");
    }, FLUSH_TIMEOUT_MS);
  }, [teardownCapture, clearStopTimer]);

  const speak = useCallback(
    async (text: string) => {
      const gen = ++genRef.current;
      const stale = () => genRef.current !== gen;
      ttsRef.current?.stop();
      ttsRef.current = null;
      const ctx = primePlayback();
      setState("speaking");
      try {
        const { token } = await getGradiumToken();
        if (stale()) return;
        const player = new TtsPlayer({ token, voiceId: getSettings().voiceId, audioContext: ctx });
        ttsRef.current = player;
        await player.speak(text);
        if (stale() || ttsRef.current !== player) return;
        ttsRef.current = null;
      } catch {
        if (stale()) return;
      }
      setState("idle");
    },
    [primePlayback],
  );

  const stop = useCallback(() => {
    genRef.current += 1;
    clearStopTimer();
    ttsRef.current?.stop();
    ttsRef.current = null;
    teardownCapture();
    setState("idle");
  }, [teardownCapture, clearStopTimer]);

  useEffect(
    () => () => {
      genRef.current += 1;
      clearStopTimer();
      ttsRef.current?.stop();
      teardownCapture();
      void playCtxRef.current?.close().catch(() => undefined);
      playCtxRef.current = null;
    },
    [teardownCapture, clearStopTimer],
  );

  return { state, partial, startListening, stopListening, speak, stop, setState };
}
