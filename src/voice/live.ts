import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { LiveConnectParameters, LiveServerMessage } from "@google/genai";
import type { Level, SceneResult } from "../lib/types";
import { workletUrl } from "./pcm-worklet";
import { floatTo16BitPCM, StreamResampler, toBase64 } from "./stt";
import { pcm16ToFloat32 } from "./tts";

export const LIVE_MODEL = "gemini-3.8-live";
export const LIVE_INPUT_RATE = 16000;
export const LIVE_OUTPUT_RATE = 24000;
/** 100 ms of 16 kHz audio per realtime message. */
const MIC_CHUNK = 1600;
const TASK_DONE = "mark_task_done";

export interface LiveRoleplayOptions {
  mode?: "roleplay";
  token: string;
  scene: SceneResult;
  level: Level;
  knownWords: string[];
  recallPhrase?: string;
  model?: string;
}

/** Listen mode: Gemini hears a real conversation and answers each utterance with its translation as text. */
export interface LiveListenOptions {
  mode: "listen";
  token: string;
  from?: "fr";
  to?: "en";
  model?: string;
}

export type LiveConnectOptions = LiveRoleplayOptions | LiveListenOptions;

export interface LiveEvents {
  open: void;
  userText: { text: string; final: boolean };
  tutorText: { text: string; final: boolean };
  speaking: boolean;
  taskDone: void;
  error: string;
  closed: void;
}

type Handler<T> = (payload: T) => void;

/** The subset of the SDK session LiveSession uses. */
export interface LiveSessionHandle {
  sendRealtimeInput(params: { audio: { data: string; mimeType: string } }): void;
  sendToolResponse(params: {
    functionResponses: { id?: string; name?: string; response?: Record<string, unknown> }[];
  }): void;
  close(): void;
}

export interface LiveClient {
  live: { connect(params: LiveConnectParameters): Promise<LiveSessionHandle> };
}

export interface LiveDeps {
  GoogleGenAI?: new (opts: { apiKey: string; httpOptions: { apiVersion: string } }) => LiveClient;
  /** Playback context; return undefined to run without audio output. */
  createAudioContext?: () => AudioContext | undefined;
  /** Starts the microphone, calls onSamples with mono float frames, resolves to a stop function. */
  startMic?: (onSamples: (samples: Float32Array, rate: number) => void) => Promise<() => void>;
}

export function buildListenPrompt({ from, to }: { from: "fr"; to: "en" }): string {
  const name = (code: string) => (code === "fr" ? "French" : "English");
  return [
    `You hear a live conversation in ${name(from)}.`,
    `For every utterance you hear, reply with ONLY its ${name(to)} translation, one line, no commentary, no quotes, keep names, keep it short;`,
    `if it is not ${name(from)} or not speech, reply with an empty line.`,
  ].join(" ");
}

export function buildLivePrompt(opts: Pick<LiveRoleplayOptions, "scene" | "level" | "knownWords" | "recallPhrase">): string {
  const { scene, level, knownWords, recallPhrase } = opts;
  const objects = scene.objects.map((o) => `${o.article} ${o.fr}`).join(", ");
  const known = knownWords.length ? knownWords.join(", ") : "(none yet)";
  const lines = [
    `You are Noé, a barista in a café in Zurich. ${scene.task.role ? `The learner plays: ${scene.task.role}.` : ""}`.trim(),
    "Speak only French. Stay in character at all times.",
    "Use short sentences.",
    `The learner's level is ${level}. 95 % of your words must be in the known words list or basic A1 vocabulary.`,
    "Introduce at most two new words or phrases per turn.",
    "Never correct the learner mid-conversation. Just keep the conversation going.",
    `Known words: ${known}.`,
    `Place: ${scene.place}.`,
    `Objects in the scene: ${objects}.`,
    `The learner's task: ${scene.task.fr}`,
  ];
  if (recallPhrase) lines.push(`Open the conversation with this phrase: "${recallPhrase}".`);
  lines.push(
    `When the learner has completed the task, call the ${TASK_DONE} function, then say goodbye in one line.`,
  );
  return lines.join("\n");
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function rateOf(mimeType: string | undefined): number {
  const m = /rate=(\d+)/.exec(mimeType ?? "");
  return m ? Number(m[1]) : LIVE_OUTPUT_RATE;
}

function audioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext;
}

function defaultAudioContext(): AudioContext | undefined {
  const Ctx = audioContextCtor();
  return Ctx ? new Ctx() : undefined;
}

export async function defaultStartMic(onSamples: (samples: Float32Array, rate: number) => void): Promise<() => void> {
  const Ctx = audioContextCtor();
  const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  if (!Ctx || !media?.getUserMedia || typeof AudioWorkletNode === "undefined") {
    throw new Error("microphone unavailable");
  }
  const stream = await media.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const ctx = new Ctx();
  const url = workletUrl();
  try {
    await ctx.audioWorklet.addModule(url);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    URL.revokeObjectURL(url);
    void ctx.close().catch(() => undefined);
    throw e;
  }
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "pcm-capture");
  node.port.onmessage = (ev: MessageEvent<Float32Array>) => onSamples(ev.data, ctx.sampleRate);
  source.connect(node);
  return () => {
    node.port.onmessage = null;
    node.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    URL.revokeObjectURL(url);
    void ctx.close().catch(() => undefined);
  };
}

export class LiveSession {
  private deps: LiveDeps;
  private handlers: { [K in keyof LiveEvents]?: Handler<LiveEvents[K]>[] } = {};
  private session: LiveSessionHandle | null = null;
  private stopMic: (() => void) | null = null;
  private playCtx: AudioContext | undefined;
  private sources = new Set<AudioBufferSourceNode>();
  private playHead = 0;
  private speaking = false;
  private userBuf = "";
  private tutorBuf = "";
  private resampler = new StreamResampler();
  private micBuf = new Int16Array(0);
  private ended = false;
  private listen = false;

  constructor(deps: LiveDeps = {}) {
    this.deps = deps;
  }

  on<K extends keyof LiveEvents>(event: K, handler: Handler<LiveEvents[K]>): () => void {
    const list = (this.handlers[event] ??= []) as Handler<LiveEvents[K]>[];
    list.push(handler);
    return () => {
      const i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    };
  }

  private emit<K extends keyof LiveEvents>(event: K, ...args: LiveEvents[K] extends void ? [] : [LiveEvents[K]]): void {
    const list = this.handlers[event] as Handler<LiveEvents[K]>[] | undefined;
    list?.slice().forEach((h) => h(args[0] as LiveEvents[K]));
  }

  /** Audio buffers scheduled and not yet finished. */
  get queued(): number {
    return this.sources.size;
  }

  async connect(opts: LiveConnectOptions): Promise<void> {
    const Ctor = this.deps.GoogleGenAI ?? (GoogleGenAI as unknown as NonNullable<LiveDeps["GoogleGenAI"]>);
    const ai = new Ctor({ apiKey: opts.token, httpOptions: { apiVersion: "v1beta" } });
    this.listen = opts.mode === "listen";
    if (!this.listen) {
      // Create the playback context before any await so it can start inside the user gesture.
      this.playCtx = (this.deps.createAudioContext ?? defaultAudioContext)();
      if (this.playCtx?.state === "suspended") void this.playCtx.resume().catch(() => undefined);
    }
    const config: LiveConnectParameters["config"] =
      opts.mode === "listen"
        ? {
            // Text only: no voice, no tools, no playback.
            responseModalities: [Modality.TEXT],
            systemInstruction: buildListenPrompt({ from: opts.from ?? "fr", to: opts.to ?? "en" }),
            inputAudioTranscription: {},
          }
        : {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
            systemInstruction: buildLivePrompt(opts),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools: [
              {
                functionDeclarations: [
                  {
                    name: TASK_DONE,
                    description: "call when the learner has completed the task",
                    parameters: { type: Type.OBJECT, properties: {} },
                  },
                ],
              },
            ],
          };
    try {
      this.session = await ai.live.connect({
        model: opts.model ?? LIVE_MODEL,
        config,
        callbacks: {
          onmessage: (msg) => this.handleMessage(msg),
          onerror: (e) => this.emit("error", e?.message || "live connection error"),
          onclose: () => this.finish(),
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.emit("error", message);
      this.finish();
      throw e;
    }
    if (this.ended) {
      this.session?.close();
      return;
    }
    this.emit("open");
    try {
      const stop = await (this.deps.startMic ?? defaultStartMic)((samples, rate) => this.pushMic(samples, rate));
      if (this.ended) stop();
      else this.stopMic = stop;
    } catch (e) {
      this.emit("error", e instanceof Error ? e.message : String(e));
      this.close();
    }
  }

  close(): void {
    if (this.ended) return;
    const session = this.session;
    this.finish();
    session?.close();
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.stopMic?.();
    this.stopMic = null;
    this.clearPlayback();
    this.session = null;
    void this.playCtx?.close().catch(() => undefined);
    this.playCtx = undefined;
    this.emit("closed");
  }

  private pushMic(samples: Float32Array, rate: number): void {
    if (!this.session) return;
    const pcm = floatTo16BitPCM(this.resampler.process(samples, rate, LIVE_INPUT_RATE));
    const merged = new Int16Array(this.micBuf.length + pcm.length);
    merged.set(this.micBuf);
    merged.set(pcm, this.micBuf.length);
    let offset = 0;
    while (merged.length - offset >= MIC_CHUNK) {
      const chunk = merged.slice(offset, offset + MIC_CHUNK);
      this.session.sendRealtimeInput({
        audio: { data: toBase64(new Uint8Array(chunk.buffer)), mimeType: `audio/pcm;rate=${LIVE_INPUT_RATE}` },
      });
      offset += MIC_CHUNK;
    }
    this.micBuf = merged.slice(offset);
  }

  private handleMessage(msg: LiveServerMessage): void {
    if (this.ended) return;
    const content = msg.serverContent;
    if (content) {
      if (content.interrupted) {
        this.clearPlayback();
        // Close the cut-off tutor turn so it does not merge into the next one.
        this.flushTutor();
      }
      for (const part of content.modelTurn?.parts ?? []) {
        if (this.listen) {
          // The translation of the utterance just heard.
          if (part.text && !part.thought) {
            this.flushUser();
            this.tutorBuf += part.text;
            this.emit("tutorText", { text: this.tutorBuf, final: false });
          }
          continue;
        }
        const data = part.inlineData;
        if (data?.data && (data.mimeType ?? "audio/pcm").startsWith("audio/pcm")) {
          this.enqueue(pcm16ToFloat32(base64ToBytes(data.data)), rateOf(data.mimeType));
        }
      }
      const input = content.inputTranscription;
      if (input?.text) {
        this.userBuf += input.text;
        this.emit("userText", { text: this.userBuf, final: false });
      }
      if (input?.finished) this.flushUser();
      const output = content.outputTranscription;
      if (output?.text) {
        // The tutor answering means the learner's turn is over.
        this.flushUser();
        this.tutorBuf += output.text;
        this.emit("tutorText", { text: this.tutorBuf, final: false });
      }
      if (output?.finished) this.flushTutor();
      if (content.turnComplete) {
        this.flushUser();
        this.flushTutor();
      }
    }
    for (const call of msg.toolCall?.functionCalls ?? []) {
      if (call.name !== TASK_DONE) continue;
      this.emit("taskDone");
      this.session?.sendToolResponse({
        functionResponses: [{ id: call.id, name: call.name, response: { ok: true } }],
      });
    }
  }

  private flushUser(): void {
    const text = this.userBuf.trim();
    this.userBuf = "";
    if (text) this.emit("userText", { text, final: true });
  }

  private flushTutor(): void {
    const text = this.tutorBuf.trim();
    this.tutorBuf = "";
    if (text) this.emit("tutorText", { text, final: true });
  }

  private enqueue(samples: Float32Array, rate: number): void {
    const ctx = this.playCtx;
    if (!ctx || !samples.length) return;
    const buffer = ctx.createBuffer(1, samples.length, rate);
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const at = Math.max(ctx.currentTime, this.playHead);
    src.onended = () => {
      if (!this.sources.delete(src)) return;
      if (this.sources.size === 0) this.setSpeaking(false);
    };
    this.sources.add(src);
    src.start(at);
    this.playHead = at + buffer.duration;
    this.setSpeaking(true);
  }

  private clearPlayback(): void {
    const list = [...this.sources];
    this.sources.clear();
    for (const src of list) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    this.playHead = 0;
    this.setSpeaking(false);
  }

  private setSpeaking(value: boolean): void {
    if (this.speaking === value) return;
    this.speaking = value;
    this.emit("speaking", value);
  }
}
