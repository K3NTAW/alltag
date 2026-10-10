import { useCallback, useEffect, useRef, useState } from "react";
import { getGradiumToken } from "../lib/api";
import { getSettings } from "../lib/settings";
import { workletUrl } from "./pcm-worklet";
import { SttSession } from "./stt";
import { TtsPlayer } from "./tts";

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

  const startListening = useCallback(async () => {
    teardownCapture();
    ttsRef.current?.stop();
    setPartial("");
    setState("listening");
    try {
      const { token } = await getGradiumToken();
      const stt = new SttSession({
        token,
        language: getSettings().language,
        onPartial: (text) => {
          setPartial(text);
          optsRef.current.onPartial?.(text);
        },
        onFinal: (text) => {
          teardownCapture();
          setPartial(text);
          setState("thinking");
          optsRef.current.onFinal(text);
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
      if (sttRef.current !== stt) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = new Ctx();
      const url = workletUrl();
      await ctx.audioWorklet.addModule(url);
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pcm-capture");
      node.port.onmessage = (ev: MessageEvent<Float32Array>) => stt.pushSamples(ev.data, ctx.sampleRate);
      source.connect(node);
      captureRef.current = { ctx, stream, node, url };
      if (sttRef.current !== stt) teardownCapture();
    } catch {
      teardownCapture();
      setState("idle");
    }
  }, [teardownCapture]);

  const stopListening = useCallback(() => {
    sttRef.current?.flush();
  }, []);

  const speak = useCallback(async (text: string) => {
    ttsRef.current?.stop();
    setState("speaking");
    try {
      const { token } = await getGradiumToken();
      const Ctx = audioContextCtor();
      if (Ctx && !playCtxRef.current) playCtxRef.current = new Ctx();
      const ctx = playCtxRef.current ?? undefined;
      if (ctx?.state === "suspended") await ctx.resume().catch(() => undefined);
      const player = new TtsPlayer({ token, voiceId: getSettings().voiceId, audioContext: ctx });
      ttsRef.current = player;
      await player.speak(text);
      if (ttsRef.current !== player) return;
      ttsRef.current = null;
    } catch {
      // fall through to idle
    }
    setState("idle");
  }, []);

  const stop = useCallback(() => {
    ttsRef.current?.stop();
    ttsRef.current = null;
    teardownCapture();
    setState("idle");
  }, [teardownCapture]);

  useEffect(
    () => () => {
      ttsRef.current?.stop();
      teardownCapture();
      void playCtxRef.current?.close().catch(() => undefined);
      playCtxRef.current = null;
    },
    [teardownCapture],
  );

  return { state, partial, startListening, stopListening, speak, stop, setState };
}
