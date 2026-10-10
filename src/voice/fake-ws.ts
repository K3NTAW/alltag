type Listener = (ev: { data?: unknown }) => void;

// Minimal WebSocket stand-in for tests. Pass as `WebSocketImpl`.
export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  static reset() {
    FakeWebSocket.instances = [];
  }

  static last(): FakeWebSocket {
    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    if (!ws) throw new Error("no FakeWebSocket created");
    return ws;
  }

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  sent: Record<string, unknown>[] = [];
  closed = false;
  onopen: Listener | null = null;
  onmessage: Listener | null = null;
  onclose: Listener | null = null;
  onerror: Listener | null = null;
  private listeners: Record<string, Listener[]> = {};

  constructor(url: string | URL) {
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, fn: Listener) {
    (this.listeners[type] ??= []).push(fn);
  }

  removeEventListener(type: string, fn: Listener) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }

  send(data: string) {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error("socket not open");
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.closed = true;
    this.dispatch("close", {});
  }

  /** Test helper: simulate the server accepting the connection. */
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatch("open", {});
  }

  /** Test helper: simulate a server message. */
  emit(msg: object) {
    this.dispatch("message", { data: JSON.stringify(msg) });
  }

  /** Sent messages of one type. */
  sentOfType(type: string) {
    return this.sent.filter((m) => m.type === type);
  }

  private dispatch(type: string, ev: { data?: unknown }) {
    const prop = (this as unknown as Record<string, Listener | null>)[`on${type}`];
    if (prop) prop(ev);
    for (const fn of this.listeners[type] ?? []) fn(ev);
  }
}
