import { act, renderHook } from "@testing-library/react";
import type { LiveConnectParameters, LiveServerMessage } from "@google/genai";
import type { SceneResult } from "../lib/types";
import type { LiveDeps } from "./live";
import { useLive } from "./useLive";

vi.mock("../lib/api", () => ({
  getLiveToken: vi.fn(async () => ({ token: "auth_tokens/fetched", expires_at: "2026-10-10T12:30:00Z" })),
}));

const scene: SceneResult = {
  place: "café",
  objects: [],
  task: { fr: "Commande un café.", en: "Order a coffee.", role: "client" },
};

class FakeSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect() {}
  start() {}
  stop() {}
}

class FakeAudioContext {
  currentTime = 0;
  state = "running";
  destination = {};
  sources: FakeSource[] = [];
  createBuffer(_ch: number, length: number, rate: number) {
    const data = new Float32Array(length);
    return { duration: length / rate, getChannelData: () => data };
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  close() {
    return Promise.resolve();
  }
}

function makeDeps(opts: { fail?: boolean } = {}) {
  const ctx = new FakeAudioContext();
  const session = { closed: false, sendRealtimeInput() {}, sendToolResponse() {}, close() { session.closed = true; } };
  const state = {
    ctorArgs: null as unknown,
    params: null as LiveConnectParameters | null,
    session,
    send(msg: Partial<LiveServerMessage>) {
      state.params?.callbacks.onmessage(msg as LiveServerMessage);
    },
  };
  class Ctor {
    live = {
      connect: async (params: LiveConnectParameters) => {
        state.params = params;
        if (opts.fail) throw new Error("connect refused");
        return session;
      },
    };
    constructor(args: unknown) {
      state.ctorArgs = args;
    }
  }
  const deps: LiveDeps = {
    GoogleGenAI: Ctor as unknown as NonNullable<LiveDeps["GoogleGenAI"]>,
    createAudioContext: () => ctx as unknown as AudioContext,
    startMic: async () => () => undefined,
  };
  return { deps, ai: { state }, ctx };
}

function audioMessage(): Partial<LiveServerMessage> {
  return {
    serverContent: {
      modelTurn: { parts: [{ inlineData: { data: btoa("\0\0\0\0"), mimeType: "audio/pcm;rate=24000" } }] },
    },
  };
}

const opts = { scene, level: "A1" as const, knownWords: ["café"] };

describe("useLive", () => {
  it("goes idle -> connecting -> listening -> speaking -> listening -> done", async () => {
    const { deps, ai, ctx } = makeDeps();
    const { result } = renderHook(() => useLive(deps));
    expect(result.current.state).toBe("idle");
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.start(opts);
    });
    expect(result.current.state).toBe("connecting");
    await act(async () => {
      await pending;
    });
    expect(ai.state.ctorArgs).toMatchObject({ apiKey: "auth_tokens/fetched" });
    expect(result.current.state).toBe("listening");

    act(() => ai.state.send({ serverContent: { inputTranscription: { text: "Un café" } } }));
    expect(result.current.partialUser).toBe("Un café");

    act(() => ai.state.send(audioMessage()));
    expect(result.current.state).toBe("speaking");
    act(() => ctx.sources[0].onended?.());
    expect(result.current.state).toBe("listening");

    act(() => {
      ai.state.send({ serverContent: { outputTranscription: { text: "Voilà." } } });
      ai.state.send({ serverContent: { turnComplete: true } });
    });
    expect(result.current.partialUser).toBe("");
    expect(result.current.transcript).toEqual([
      { role: "learner", text: "Un café" },
      { role: "tutor", text: "Voilà." },
    ]);

    act(() => ai.state.send({ toolCall: { functionCalls: [{ id: "c", name: "mark_task_done" }] } }));
    expect(result.current.state).toBe("done");
    act(() => ai.state.send(audioMessage()));
    expect(result.current.state).toBe("done");

    act(() => result.current.stop());
    expect(result.current.state).toBe("idle");
    expect(ai.state.session.closed).toBe(true);
  });

  it("goes to error on a connect failure", async () => {
    const { deps } = makeDeps({ fail: true });
    const { result } = renderHook(() => useLive(deps));
    await act(async () => {
      await result.current.start({ ...opts, token: "auth_tokens/t" });
    });
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("connect refused");
  });
});
