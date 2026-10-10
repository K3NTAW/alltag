import { FakeWebSocket } from "./fake-ws";
import { floatTo16BitPCM, resampleLinear, SttSession, toBase64 } from "./stt";

function session(onFinal = vi.fn(), onVad = vi.fn()) {
  FakeWebSocket.reset();
  const stt = new SttSession({
    token: "tok",
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    onFinal,
    onVad,
  });
  stt.open();
  const ws = FakeWebSocket.last();
  ws.open();
  return { stt, ws, onFinal, onVad };
}

const step = (prob: number) => ({
  type: "step",
  vad: [0.5, 1, 2, 3].map((h) => ({ horizon_s: h, inactivity_prob: h === 3 ? prob : 0.9 })),
});

describe("SttSession", () => {
  it("sends setup first with language fr and delay_in_frames 10", () => {
    const { ws } = session();
    expect(ws.url).toBe("wss://api.gradium.ai/api/speech/asr?token=tok");
    expect(ws.sent[0]).toEqual({
      type: "setup",
      model_name: "default",
      input_format: "pcm",
      json_config: { language: "fr", delay_in_frames: 10 },
    });
  });

  it("chunks 24 kHz input into 1920-sample messages and holds the rest", () => {
    const { stt, ws } = session();
    stt.pushSamples(new Float32Array(4000), 24000);
    const audio = ws.sentOfType("audio");
    expect(audio).toHaveLength(2);
    expect(stt.bufferedSamples).toBe(160);
    expect(atob(audio[0].audio as string)).toHaveLength(1920 * 2);
  });

  it("resamples 48 kHz input before chunking", () => {
    const { stt, ws } = session();
    stt.pushSamples(new Float32Array(1920), 48000);
    expect(ws.sentOfType("audio")).toHaveLength(0);
    stt.pushSamples(new Float32Array(1920), 48000);
    expect(ws.sentOfType("audio")).toHaveLength(1);
  });

  it("fires onFinal once when the 3 s inactivity prob exceeds 0.5", () => {
    const { ws, onFinal, onVad } = session();
    ws.emit({ type: "text", text: "Bonjour", start_s: 0.1 });
    ws.emit({ type: "text", text: "madame", start_s: 0.5 });
    ws.emit(step(0.2));
    expect(onFinal).not.toHaveBeenCalled();
    ws.emit(step(0.6));
    expect(onVad).toHaveBeenLastCalledWith(0.6);
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith("Bonjour madame");
    ws.emit(step(0.6));
    expect(onFinal).toHaveBeenCalledTimes(1);
  });

  it("ends the turn on flushed and sends incrementing flush ids", () => {
    const { stt, ws, onFinal } = session();
    stt.flush();
    stt.flush();
    expect(ws.sentOfType("send_flush").map((m) => m.flush_id)).toEqual([1, 2]);
    ws.emit({ type: "text", text: "oui" });
    ws.emit({ type: "flushed", flush_id: 1 });
    expect(onFinal).toHaveBeenCalledWith("oui");
  });

  it("close sends end_of_stream and closes the socket", () => {
    const { stt, ws } = session();
    stt.close();
    expect(ws.sent[ws.sent.length - 1]).toEqual({ type: "end_of_stream" });
    expect(ws.closed).toBe(true);
  });
});

describe("pcm helpers", () => {
  it("converts float to int16 with clipping", () => {
    expect(Array.from(floatTo16BitPCM(new Float32Array([0, 1, -1, 2])))).toEqual([0, 32767, -32768, 32767]);
  });

  it("resamples linearly", () => {
    expect(Array.from(resampleLinear(new Float32Array([0, 1, 2, 3]), 48000, 24000))).toEqual([0, 2]);
  });

  it("encodes base64", () => {
    expect(toBase64(new Uint8Array([104, 105]))).toBe("aGk=");
  });
});
