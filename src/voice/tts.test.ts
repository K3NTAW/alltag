import { FakeWebSocket } from "./fake-ws";
import { pcm16ToFloat32, TtsPlayer } from "./tts";

function player() {
  FakeWebSocket.reset();
  return new TtsPlayer({
    token: "tok",
    voiceId: "voice-1",
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });
}

describe("TtsPlayer", () => {
  it("sends setup, then text, then end_of_stream and resolves on end_of_stream", async () => {
    const p = player();
    const done = p.speak("Bonjour");
    const ws = FakeWebSocket.last();
    expect(ws.url).toBe("wss://api.gradium.ai/api/speech/tts?token=tok");
    ws.open();
    expect(ws.sent[0]).toEqual({
      type: "setup",
      voice_id: "voice-1",
      model_name: "default",
      output_format: "pcm",
    });
    expect(ws.sent.map((m) => m.type)).toEqual(["setup", "text", "end_of_stream"]);
    expect(ws.sent[1]).toEqual({ type: "text", text: "Bonjour" });
    ws.emit({ type: "audio", audio: "AAAA" });
    ws.emit({ type: "end_of_stream" });
    await expect(done).resolves.toBeUndefined();
  });

  it("stop() closes the socket and resolves speak", async () => {
    const p = player();
    const done = p.speak("Salut");
    const ws = FakeWebSocket.last();
    ws.open();
    p.stop();
    expect(ws.closed).toBe(true);
    await expect(done).resolves.toBeUndefined();
  });
});

describe("pcm16ToFloat32", () => {
  it("maps int16 extremes to [-1, 1]", () => {
    const bytes = new Uint8Array(new Int16Array([32767, -32768, 0]).buffer);
    const out = pcm16ToFloat32(bytes);
    expect(out[0]).toBeCloseTo(1, 3);
    expect(out[1]).toBe(-1);
    expect(out[2]).toBe(0);
  });
});
