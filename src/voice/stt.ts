const STT_URL = "wss://api.gradium.ai/api/speech/asr";
export const STT_RATE = 24000;
export const STT_CHUNK = 1920;

export function resampleLinear(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate || input.length === 0) return input;
  const outLen = Math.floor((input.length * outputRate) / inputRate);
  const out = new Float32Array(outLen);
  const ratio = inputRate / outputRate;
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = pos - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

interface SttOptions {
  token: string;
  language?: string;
  WebSocketImpl?: typeof WebSocket;
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onVad?: (prob3s: number) => void;
}

interface ServerMessage {
  type: string;
  text?: string;
  vad?: { horizon_s: number; inactivity_prob: number }[];
}

export class SttSession {
  private opts: SttOptions;
  private ws: WebSocket | null = null;
  private buffer = new Int16Array(0);
  private queue: string[] = [];
  private turn: string[] = [];
  private flushId = 0;

  constructor(opts: SttOptions) {
    this.opts = opts;
  }

  /** Samples held back until a full 1920-sample chunk is available. */
  get bufferedSamples(): number {
    return this.buffer.length;
  }

  open(): void {
    if (this.ws) return;
    const Impl = this.opts.WebSocketImpl ?? WebSocket;
    const ws = new Impl(`${STT_URL}?token=${encodeURIComponent(this.opts.token)}`);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "setup",
          model_name: "default",
          input_format: "pcm",
          json_config: { language: this.opts.language ?? "fr", delay_in_frames: 10 },
        }),
      );
      for (const msg of this.queue) ws.send(msg);
      this.queue = [];
    };
    ws.onmessage = (ev: MessageEvent) => this.handle(ev.data);
  }

  pushSamples(samples: Float32Array, inputRate: number): void {
    const pcm = floatTo16BitPCM(resampleLinear(samples, inputRate, STT_RATE));
    const merged = new Int16Array(this.buffer.length + pcm.length);
    merged.set(this.buffer);
    merged.set(pcm, this.buffer.length);
    let offset = 0;
    while (merged.length - offset >= STT_CHUNK) {
      const chunk = merged.slice(offset, offset + STT_CHUNK);
      this.send({ type: "audio", audio: toBase64(new Uint8Array(chunk.buffer)) });
      offset += STT_CHUNK;
    }
    this.buffer = merged.slice(offset);
  }

  flush(): void {
    this.flushId += 1;
    this.send({ type: "send_flush", flush_id: this.flushId });
  }

  close(): void {
    const ws = this.ws;
    if (!ws) return;
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: "end_of_stream" }));
    ws.close();
    this.ws = null;
    this.queue = [];
  }

  private send(msg: object): void {
    const data = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === 1) this.ws.send(data);
    else this.queue.push(data);
  }

  private handle(raw: unknown): void {
    if (typeof raw !== "string") return;
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    if (msg.type === "text" && msg.text) {
      this.turn.push(msg.text);
      this.opts.onPartial?.(this.turnText());
    } else if (msg.type === "step") {
      const h3 = msg.vad?.find((v) => v.horizon_s === 3);
      if (!h3) return;
      this.opts.onVad?.(h3.inactivity_prob);
      if (h3.inactivity_prob > 0.5) this.endTurn();
    } else if (msg.type === "flushed") {
      this.endTurn();
    }
  }

  private turnText(): string {
    return this.turn.join(" ").replace(/\s+/g, " ").trim();
  }

  private endTurn(): void {
    const text = this.turnText();
    if (!text) return;
    this.turn = [];
    this.opts.onFinal(text);
  }
}
