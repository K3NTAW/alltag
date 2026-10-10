import type { LiveConnectParameters, LiveServerMessage } from "@google/genai";
import type { SceneResult } from "../lib/types";
import { buildListenPrompt, buildLivePrompt, LiveSession } from "./live";
import type { LiveDeps, LiveSessionHandle } from "./live";

const scene: SceneResult = {
  place: "café",
  objects: [
    {
      id: "o1",
      fr: "tasse",
      en: "cup",
      article: "la",
      gender: "f",
      plural: "tasses",
      level: "A1",
      phrase_fr: "une tasse de café",
      phrase_en: "a cup of coffee",
    },
    {
      id: "o2",
      fr: "croissant",
      en: "croissant",
      article: "le",
      gender: "m",
      plural: "croissants",
      level: "A1",
      phrase_fr: "un croissant, s'il vous plaît",
      phrase_en: "a croissant, please",
    },
  ],
  task: { fr: "Commande un café et un croissant.", en: "Order a coffee and a croissant.", role: "client" },
};

class FakeSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  started: number | null = null;
  stopped = false;
  connect() {}
  start(at: number) {
    this.started = at;
  }
  stop() {
    this.stopped = true;
  }
  end() {
    this.onended?.();
  }
}

class FakeAudioContext {
  currentTime = 0;
  state = "running";
  destination = {};
  sources: FakeSource[] = [];
  closed = false;
  createBuffer(_ch: number, length: number, rate: number) {
    const data = new Float32Array(length);
    return { duration: length / rate, getChannelData: () => data };
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

class FakeLiveSession implements LiveSessionHandle {
  realtime: { audio: { data: string; mimeType: string } }[] = [];
  toolResponses: unknown[] = [];
  closed = false;
  sendRealtimeInput(p: { audio: { data: string; mimeType: string } }) {
    this.realtime.push(p);
  }
  sendToolResponse(p: unknown) {
    this.toolResponses.push(p);
  }
  close() {
    this.closed = true;
  }
}

/** Fake GoogleGenAI whose live.connect records params and resolves (or rejects). */
function fakeGenAI(opts: { fail?: boolean } = {}) {
  const state: {
    params: LiveConnectParameters | null;
    ctorArgs: unknown;
    session: FakeLiveSession;
    send(msg: Partial<LiveServerMessage>): void;
  } = {
    params: null,
    ctorArgs: null,
    session: new FakeLiveSession(),
    send(msg) {
      state.params?.callbacks.onmessage(msg as LiveServerMessage);
    },
  };
  class Ctor {
    live = {
      connect: async (params: LiveConnectParameters) => {
        state.params = params;
        if (opts.fail) throw new Error("connect refused");
        params.callbacks.onopen?.();
        return state.session;
      },
    };
    constructor(args: unknown) {
      state.ctorArgs = args;
    }
  }
  return { Ctor: Ctor as unknown as NonNullable<LiveDeps["GoogleGenAI"]>, state };
}

function makeDeps(opts: { fail?: boolean } = {}) {
  const ai = fakeGenAI(opts);
  const ctx = new FakeAudioContext();
  let mic: ((s: Float32Array, rate: number) => void) | null = null;
  const stopMic = vi.fn();
  const deps: LiveDeps = {
    GoogleGenAI: ai.Ctor,
    createAudioContext: () => ctx as unknown as AudioContext,
    startMic: async (onSamples) => {
      mic = onSamples;
      return stopMic;
    },
  };
  return { deps, ai, ctx, stopMic, pushMic: (s: Float32Array, rate: number) => mic?.(s, rate) };
}

function audioMessage(samples = 480): Partial<LiveServerMessage> {
  const bytes = new Uint8Array(samples * 2);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return {
    serverContent: { modelTurn: { parts: [{ inlineData: { data: btoa(bin), mimeType: "audio/pcm;rate=24000" } }] } },
  };
}

const base = { token: "auth_tokens/t", scene, level: "A1" as const, knownWords: ["café", "bonjour"] };

describe("buildLivePrompt", () => {
  it("contains the task, the objects, the 95 percent rule and the recall phrase", () => {
    const p = buildLivePrompt({ ...base, recallPhrase: "Encore une tasse ?" });
    expect(p).toContain("Noé");
    expect(p).toContain("Speak only French");
    expect(p).toContain(scene.task.fr);
    expect(p).toContain("tasse");
    expect(p).toContain("croissant");
    expect(p).toContain("95 %");
    expect(p).toContain("café, bonjour");
    expect(p).toContain("Encore une tasse ?");
    expect(p).toContain("mark_task_done");
    expect(buildLivePrompt(base)).not.toContain("Open the conversation");
  });
});

describe("LiveSession", () => {
  it("connects with v1beta, the token and the live config", async () => {
    const { deps, ai } = makeDeps();
    const s = new LiveSession(deps);
    await s.connect({ ...base, recallPhrase: "Re-bonjour" });
    expect(ai.state.ctorArgs).toEqual({ apiKey: "auth_tokens/t", httpOptions: { apiVersion: "v1beta" } });
    const params = ai.state.params!;
    expect(params.model).toBe("gemini-3.8-live");
    expect(params.config?.responseModalities).toEqual(["AUDIO"]);
    expect(params.config?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName).toBe("Puck");
    expect(params.config?.inputAudioTranscription).toEqual({});
    expect(params.config?.outputAudioTranscription).toEqual({});
    expect(params.config?.systemInstruction).toContain("Re-bonjour");
    const fn = (params.config?.tools?.[0] as { functionDeclarations?: { name?: string }[] }).functionDeclarations?.[0];
    expect(fn?.name).toBe("mark_task_done");
  });

  it("sends mic audio as 16 kHz PCM16 base64 in 100 ms chunks", async () => {
    const { deps, ai, pushMic } = makeDeps();
    const s = new LiveSession(deps);
    await s.connect(base);
    pushMic(new Float32Array(1000), 16000);
    expect(ai.state.session.realtime).toHaveLength(0);
    pushMic(new Float32Array(1000), 16000);
    expect(ai.state.session.realtime).toHaveLength(1);
    const { audio } = ai.state.session.realtime[0];
    expect(audio.mimeType).toBe("audio/pcm;rate=16000");
    expect(atob(audio.data)).toHaveLength(3200);
  });

  it("accumulates transcription into userText and tutorText events, final on turnComplete", async () => {
    const { deps, ai } = makeDeps();
    const s = new LiveSession(deps);
    const user: { text: string; final: boolean }[] = [];
    const tutor: { text: string; final: boolean }[] = [];
    s.on("userText", (e) => user.push(e));
    s.on("tutorText", (e) => tutor.push(e));
    await s.connect(base);
    ai.state.send({ serverContent: { inputTranscription: { text: "Un café" } } });
    ai.state.send({ serverContent: { inputTranscription: { text: ", s'il vous plaît" } } });
    ai.state.send({ serverContent: { outputTranscription: { text: "Bien sûr" } } });
    ai.state.send({ serverContent: { outputTranscription: { text: ", tout de suite." } } });
    ai.state.send({ serverContent: { turnComplete: true } });
    expect(user).toEqual([
      { text: "Un café", final: false },
      { text: "Un café, s'il vous plaît", final: false },
      { text: "Un café, s'il vous plaît", final: true },
    ]);
    expect(tutor).toEqual([
      { text: "Bien sûr", final: false },
      { text: "Bien sûr, tout de suite.", final: false },
      { text: "Bien sûr, tout de suite.", final: true },
    ]);
  });

  it("plays model audio, then an interrupted message clears the queue and emits speaking false", async () => {
    const { deps, ai, ctx } = makeDeps();
    const s = new LiveSession(deps);
    const speaking: boolean[] = [];
    s.on("speaking", (v) => speaking.push(v));
    await s.connect(base);
    ai.state.send(audioMessage(480));
    ai.state.send(audioMessage(480));
    expect(s.queued).toBe(2);
    expect(ctx.sources[0].started).toBe(0);
    expect(ctx.sources[1].started).toBeCloseTo(0.02);
    expect(speaking).toEqual([true]);
    ai.state.send({ serverContent: { interrupted: true } });
    expect(s.queued).toBe(0);
    expect(ctx.sources.every((src) => src.stopped)).toBe(true);
    expect(speaking).toEqual([true, false]);
  });

  it("closes the interrupted tutor turn instead of merging it into the next", async () => {
    const { deps, ai } = makeDeps();
    const s = new LiveSession(deps);
    const tutor: { text: string; final: boolean }[] = [];
    s.on("tutorText", (e) => e.final && tutor.push(e));
    await s.connect(base);
    ai.state.send({ serverContent: { outputTranscription: { text: "Bien sûr, je" } } });
    ai.state.send({ serverContent: { interrupted: true } });
    ai.state.send({ serverContent: { outputTranscription: { text: "Oui ?" } } });
    ai.state.send({ serverContent: { turnComplete: true } });
    expect(tutor).toEqual([
      { text: "Bien sûr, je", final: true },
      { text: "Oui ?", final: true },
    ]);
  });

  it("emits speaking false when the queue drains", async () => {
    const { deps, ai, ctx } = makeDeps();
    const s = new LiveSession(deps);
    const speaking: boolean[] = [];
    s.on("speaking", (v) => speaking.push(v));
    await s.connect(base);
    ai.state.send(audioMessage());
    ctx.sources[0].end();
    expect(speaking).toEqual([true, false]);
  });

  it("emits taskDone and sends a tool response on mark_task_done", async () => {
    const { deps, ai } = makeDeps();
    const s = new LiveSession(deps);
    const done = vi.fn();
    s.on("taskDone", done);
    await s.connect(base);
    ai.state.send({ toolCall: { functionCalls: [{ id: "call-1", name: "mark_task_done", args: {} }] } });
    expect(done).toHaveBeenCalledTimes(1);
    expect(ai.state.session.toolResponses).toEqual([
      { functionResponses: [{ id: "call-1", name: "mark_task_done", response: { ok: true } }] },
    ]);
  });

  it("close() ends the session, stops the mic and emits closed once", async () => {
    const { deps, ai, ctx, stopMic } = makeDeps();
    const s = new LiveSession(deps);
    const closed = vi.fn();
    s.on("closed", closed);
    await s.connect(base);
    s.close();
    s.close();
    expect(ai.state.session.closed).toBe(true);
    expect(stopMic).toHaveBeenCalledTimes(1);
    expect(ctx.closed).toBe(true);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("emits error and rejects when connect fails", async () => {
    const { deps } = makeDeps({ fail: true });
    const s = new LiveSession(deps);
    const err = vi.fn();
    s.on("error", err);
    await expect(s.connect(base)).rejects.toThrow("connect refused");
    expect(err).toHaveBeenCalledWith("connect refused");
  });
});

describe("LiveSession listen mode", () => {
  const listen = { mode: "listen" as const, token: "auth_tokens/t" };

  it("builds the listen prompt", () => {
    const p = buildListenPrompt({ from: "fr", to: "en" });
    expect(p).toContain("live conversation in French");
    expect(p).toContain("ONLY its English translation");
    expect(p).toContain("empty line");
  });

  it("connects with TEXT modality, no tools, no speech config and input transcription", async () => {
    const { deps, ai } = makeDeps();
    await new LiveSession(deps).connect(listen);
    const config = ai.state.params!.config!;
    expect(ai.state.params!.model).toBe("gemini-3.8-live");
    expect(config.responseModalities).toEqual(["TEXT"]);
    expect(config.tools).toBeUndefined();
    expect(config.speechConfig).toBeUndefined();
    expect(config.outputAudioTranscription).toBeUndefined();
    expect(config.inputAudioTranscription).toEqual({});
    expect(config.systemInstruction).toBe(buildListenPrompt({ from: "fr", to: "en" }));
  });

  it("emits no tutorText for modelTurn text, closes the French on turnComplete, and never plays audio", async () => {
    const { deps, ai, ctx } = makeDeps();
    const createAudioContext = vi.fn(deps.createAudioContext);
    const s = new LiveSession({ ...deps, createAudioContext });
    const user: { text: string; final: boolean }[] = [];
    const tutor: { text: string; final: boolean }[] = [];
    s.on("userText", (e) => user.push(e));
    s.on("tutorText", (e) => tutor.push(e));
    await s.connect(listen);
    ai.state.send({ serverContent: { inputTranscription: { text: "On se voit demain" } } });
    ai.state.send({ serverContent: { modelTurn: { parts: [{ text: "See you" }] } } });
    ai.state.send({ serverContent: { modelTurn: { parts: [{ text: " tomorrow" }] } } });
    ai.state.send(audioMessage());
    ai.state.send({ serverContent: { turnComplete: true } });
    expect(user).toEqual([
      { text: "On se voit demain", final: false },
      { text: "On se voit demain", final: true },
    ]);
    expect(tutor).toEqual([]);
    expect(createAudioContext).not.toHaveBeenCalled();
    expect(ctx.sources).toHaveLength(0);
    expect(s.queued).toBe(0);
  });

  it("captures the mic at 16 kHz like roleplay", async () => {
    const { deps, ai, pushMic } = makeDeps();
    await new LiveSession(deps).connect(listen);
    pushMic(new Float32Array(1600), 16000);
    expect(ai.state.session.realtime[0].audio.mimeType).toBe("audio/pcm;rate=16000");
  });
});
