// On-device Gemma 3 1B through the MediaPipe LLM Inference API (WebGPU).
// The model file is gated and ~700 MB, so the app never fetches it on its own:
// the human picks it in Settings (or downloads from VITE_GEMMA_MODEL_URL) and it
// lives in the Origin Private File System. The native app can ship it in its
// bundle at BUNDLED_PATH instead; then it loads straight from the app origin.

export const MODEL_FILE = "gemma3-1b-it-int4-web.task";
export const BUNDLED_PATH = `/models/${MODEL_FILE}`;
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm";
const CHUNK = 8 * 1024 * 1024;

export type GemmaState = "unavailable" | "absent" | "loading" | "ready" | "error";

export type GemmaSource = "bundled" | "opfs" | "url";

export interface GemmaStatus {
  state: GemmaState;
  progress?: number;
  reason?: string;
  source?: GemmaSource | null;
}

interface Writable {
  write(data: Blob | Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

interface FileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<Writable>;
}

export interface StorageDir {
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandle>;
  removeEntry(name: string): Promise<void>;
}

export interface Engine {
  generateResponse(prompt: string): Promise<string>;
  close?(): void;
}

export interface GenAi {
  FilesetResolver: { forGenAiTasks(basePath?: string): Promise<unknown> };
  LlmInference: {
    createFromOptions(
      fileset: never,
      options: {
        baseOptions: { modelAssetPath: string };
        maxTokens: number;
        topK: number;
        temperature: number;
        randomSeed: number;
      },
    ): Promise<Engine>;
  };
}

export interface GemmaDeps {
  hasGpu(): boolean;
  hasStorage(): boolean;
  root(): Promise<StorageDir>;
  genai(): Promise<GenAi>;
  objectUrl(blob: Blob): string;
  revokeUrl(url: string): void;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  /** Absolute URL of the bundled model, or null when the origin is not http(s). */
  bundledUrl(): string | null;
}

export const browserDeps: GemmaDeps = {
  hasGpu: () => typeof navigator !== "undefined" && "gpu" in navigator && !!(navigator as { gpu?: unknown }).gpu,
  hasStorage: () =>
    typeof navigator !== "undefined" && !!navigator.storage && typeof navigator.storage.getDirectory === "function",
  root: () => navigator.storage.getDirectory() as unknown as Promise<StorageDir>,
  genai: () => import("@mediapipe/tasks-genai") as unknown as Promise<GenAi>,
  objectUrl: (blob) => URL.createObjectURL(blob),
  revokeUrl: (url) => URL.revokeObjectURL(url),
  fetch: (url, init) => fetch(url, init),
  bundledUrl: () =>
    typeof location !== "undefined" && /^https?:$/.test(location.protocol)
      ? new URL(BUNDLED_PATH, location.origin).href
      : null,
};

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function createGemma(deps: GemmaDeps) {
  const supported = deps.hasGpu() && deps.hasStorage();
  let snapshot: GemmaStatus = supported
    ? { state: "absent" }
    : { state: "unavailable", reason: deps.hasGpu() ? "no file system access" : "no webgpu" };
  const listeners = new Set<() => void>();
  let engine: Engine | null = null;
  let loading: Promise<void> | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let probe: Promise<string | null> | null = null;
  let bundled: string | null = null;
  let stored: GemmaSource = "opfs";

  // HEAD once per session: the native app serves the model from its bundle, the web deployment answers 404.
  function probeBundled(): Promise<string | null> {
    probe ??= (async () => {
      const url = deps.hasGpu() ? deps.bundledUrl() : null;
      if (!url) return null;
      try {
        const res = await deps.fetch(url, { method: "HEAD" });
        return res && (res.status === 200 || res.status === 206) ? url : null;
      } catch {
        return null;
      }
    })().then((url) => {
      bundled = url;
      if (url && !engine && !loading) set({ state: "absent", source: "bundled" });
      return url;
    });
    return probe;
  }

  function set(next: GemmaStatus) {
    snapshot = next;
    listeners.forEach((l) => l());
  }

  async function dir(): Promise<StorageDir> {
    if (!supported) throw new Error("offline tutor not supported");
    return deps.root();
  }

  async function storedFile(): Promise<File | null> {
    try {
      const handle = await (await dir()).getFileHandle(MODEL_FILE);
      return await handle.getFile();
    } catch {
      return null;
    }
  }

  async function write(source: Blob | ReadableStream<Uint8Array>, total: number) {
    const handle = await (await dir()).getFileHandle(MODEL_FILE, { create: true });
    const out = await handle.createWritable();
    let done = 0;
    const tick = () => set({ state: "loading", progress: total ? Math.min(100, Math.round((done / total) * 100)) : undefined });
    try {
      if (source instanceof Blob) {
        for (let at = 0; at < source.size; at += CHUNK) {
          const part = source.slice(at, at + CHUNK);
          await out.write(part);
          done += part.size;
          tick();
        }
      } else {
        const reader = source.getReader();
        for (;;) {
          const { value, done: end } = await reader.read();
          if (end) break;
          await out.write(value);
          done += value.byteLength;
          tick();
        }
      }
      await out.close();
    } catch (e) {
      await out.abort?.().catch(() => undefined);
      throw e;
    }
  }

  async function afterWrite(job: () => Promise<void>) {
    if (!supported) throw new Error("offline tutor not supported");
    engine?.close?.();
    engine = null;
    set({ state: "loading", progress: 0 });
    try {
      await job();
    } catch (e) {
      set({ state: "error", reason: message(e) });
      throw e;
    }
    await gemma.ensureLoaded();
  }

  const gemma = {
    status(): GemmaStatus {
      void probeBundled();
      return snapshot;
    },

    subscribe(cb: () => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    /** Checks OPFS for a stored model and starts loading it if present. */
    async refresh(): Promise<void> {
      if (await probeBundled()) {
        if (snapshot.state === "absent") await gemma.ensureLoaded().catch(() => undefined);
        return;
      }
      if (!supported || snapshot.state !== "absent") return;
      if (await storedFile()) await gemma.ensureLoaded().catch(() => undefined);
    },

    importFile(file: File): Promise<void> {
      stored = "opfs";
      return afterWrite(() => write(file, file.size));
    },

    importUrl(url: string): Promise<void> {
      stored = "url";
      return afterWrite(async () => {
        const res = await deps.fetch(url);
        if (!res.ok || !res.body) throw new Error(`download failed ${res.status}`);
        await write(res.body, Number(res.headers.get("content-length")) || 0);
      });
    },

    async remove(): Promise<void> {
      if (!supported || bundled) return;
      engine?.close?.();
      engine = null;
      loading = null;
      try {
        await (await dir()).removeEntry(MODEL_FILE);
      } catch {
        // already gone
      }
      set({ state: "absent" });
    },

    ensureLoaded(): Promise<void> {
      if (engine) return Promise.resolve();
      if (loading) return loading;
      loading = (async () => {
        const fromBundle = await probeBundled();
        let url: string;
        let source: GemmaSource;
        if (fromBundle) {
          url = fromBundle;
          source = "bundled";
        } else {
          if (!supported) throw new Error(snapshot.reason ?? "offline tutor not supported");
          const file = await storedFile();
          if (!file) {
            set({ state: "absent" });
            throw new Error("model not installed");
          }
          url = deps.objectUrl(file);
          source = stored;
        }
        set({ state: "loading", source });
        try {
          const { FilesetResolver, LlmInference } = await deps.genai();
          const fileset = await FilesetResolver.forGenAiTasks(WASM_BASE);
          engine = await LlmInference.createFromOptions(fileset as never, {
            baseOptions: { modelAssetPath: url },
            maxTokens: 512,
            topK: 40,
            temperature: 0.6,
            randomSeed: 1,
          });
          set({ state: "ready", source });
        } catch (e) {
          set(fromBundle ? { state: "error", reason: message(e), source: "bundled" } : { state: "error", reason: message(e) });
          throw e;
        } finally {
          if (!fromBundle) deps.revokeUrl(url);
        }
      })().finally(() => {
        loading = null;
      });
      return loading;
    },

    /** maxTokens is fixed at load time (512); opts is kept for callers that want to say so. */
    generate(prompt: string, opts?: { maxTokens?: number }): Promise<string> {
      void opts;
      // LlmInference handles one generateResponse at a time, so calls are queued.
      const run = queue.then(async () => {
        await gemma.ensureLoaded();
        if (!engine) throw new Error("model not loaded");
        return engine.generateResponse(prompt);
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };

  return gemma;
}

export type Gemma = ReturnType<typeof createGemma>;

export const gemma: Gemma = createGemma(browserDeps);
