const TTS_URL = "wss://api.gradium.ai/api/speech/tts";

export function pcm16ToFloat32(bytes: Uint8Array | Int16Array): Float32Array {
  if (bytes instanceof Int16Array) return Float32Array.from(bytes, (v) => v / 0x8000);
  const n = Math.floor(bytes.length / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface TtsOptions {
  token: string;
  voiceId: string;
  WebSocketImpl?: typeof WebSocket;
  audioContext?: AudioContext;
  sampleRate?: number;
}

export class TtsPlayer {
  private opts: TtsOptions;
  private ws: WebSocket | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;
  private finish: (() => void) | null = null;

  constructor(opts: TtsOptions) {
    this.opts = opts;
  }

  speak(text: string): Promise<void> {
    this.stop();
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.finish = null;
        resolve();
      };
      this.finish = finish;

      const Impl = this.opts.WebSocketImpl ?? WebSocket;
      const ws = new Impl(`${TTS_URL}?token=${encodeURIComponent(this.opts.token)}`);
      this.ws = ws;
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "setup",
            voice_id: this.opts.voiceId,
            model_name: "default",
            output_format: "pcm",
          }),
        );
        ws.send(JSON.stringify({ type: "text", text }));
        ws.send(JSON.stringify({ type: "end_of_stream" }));
      };
      ws.onmessage = (ev: MessageEvent) => {
        if (typeof ev.data !== "string") return;
        let msg: { type: string; audio?: string };
        try {
          msg = JSON.parse(ev.data) as { type: string; audio?: string };
        } catch {
          return;
        }
        if (msg.type === "audio" && msg.audio) this.schedule(msg.audio);
        else if (msg.type === "end_of_stream") {
          if (this.ws === ws) this.ws = null;
          ws.close();
          this.whenDrained(finish);
        }
      };
      ws.onerror = () => finish();
      ws.onclose = () => {
        // Server closed early without end_of_stream: let queued audio play out.
        if (this.ws === ws) {
          this.ws = null;
          this.whenDrained(finish);
        }
      };
    });
  }

  stop(): void {
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    this.sources = [];
    const ws = this.ws;
    this.ws = null;
    if (ws) ws.close();
    this.finish?.();
  }

  private schedule(b64: string): void {
    const ctx = this.opts.audioContext;
    if (!ctx) return;
    const samples = pcm16ToFloat32(fromBase64(b64));
    if (!samples.length) return;
    const buffer = ctx.createBuffer(1, samples.length, this.opts.sampleRate ?? 48000);
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const start = Math.max(ctx.currentTime, this.nextStartTime);
    src.start(start);
    this.nextStartTime = start + buffer.duration;
    this.sources.push(src);
    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src);
    };
  }

  private whenDrained(cb: () => void): void {
    const last = this.sources[this.sources.length - 1];
    if (!this.opts.audioContext || !last) {
      cb();
      return;
    }
    const prev = last.onended;
    last.onended = (ev) => {
      if (prev) prev.call(last, ev);
      cb();
    };
  }
}
