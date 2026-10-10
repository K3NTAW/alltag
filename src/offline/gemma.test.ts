import { createGemma, MODEL_FILE, type GemmaDeps, type StorageDir } from "./gemma";

function fakeDir() {
  const files = new Map<string, Blob>();
  const dir: StorageDir = {
    async getFileHandle(name, opts) {
      if (!files.has(name) && !opts?.create) throw new DOMException("missing", "NotFoundError");
      return {
        getFile: async () => new File([files.get(name) ?? new Blob()], name),
        createWritable: async () => {
          const parts: (Blob | Uint8Array)[] = [];
          return {
            write: async (d: Blob | Uint8Array) => {
              parts.push(d);
            },
            close: async () => {
              files.set(name, new Blob(parts as BlobPart[]));
            },
          };
        },
      };
    },
    async removeEntry(name) {
      if (!files.delete(name)) throw new DOMException("missing", "NotFoundError");
    },
  };
  return { files, dir };
}

function deps(over: Partial<GemmaDeps> = {}) {
  const { files, dir } = fakeDir();
  const generateResponse = vi.fn(async (p: string) => `echo:${p}`);
  const createFromOptions = vi.fn(async () => ({ generateResponse, close: vi.fn() }));
  const d: GemmaDeps = {
    hasGpu: () => true,
    hasStorage: () => true,
    root: async () => dir,
    genai: async () => ({
      FilesetResolver: { forGenAiTasks: async () => ({}) },
      LlmInference: { createFromOptions },
    }),
    objectUrl: () => "blob:model",
    revokeUrl: () => undefined,
    fetch: vi.fn(),
    ...over,
  };
  return { d, files, createFromOptions, generateResponse };
}

describe("gemma", () => {
  it("is unavailable without navigator.gpu", async () => {
    const g = createGemma(deps({ hasGpu: () => false }).d);
    expect(g.status().state).toBe("unavailable");
    await expect(g.ensureLoaded()).rejects.toThrow();
    await expect(g.importFile(new File(["x"], MODEL_FILE))).rejects.toThrow();
  });

  it("is unavailable without OPFS", () => {
    expect(createGemma(deps({ hasStorage: () => false }).d).status().state).toBe("unavailable");
  });

  it("starts absent and ensureLoaded rejects with no file", async () => {
    const g = createGemma(deps().d);
    expect(g.status().state).toBe("absent");
    await expect(g.ensureLoaded()).rejects.toThrow("model not installed");
    expect(g.status().state).toBe("absent");
  });

  it("importFile writes to OPFS, then ready after ensureLoaded", async () => {
    const { d, files, createFromOptions } = deps();
    const g = createGemma(d);
    const seen: string[] = [];
    g.subscribe(() => seen.push(g.status().state));
    expect(g.status().state).toBe("absent");
    await g.importFile(new File(["weights"], MODEL_FILE));
    await g.ensureLoaded();
    expect(await files.get(MODEL_FILE)?.text()).toBe("weights");
    expect(g.status().state).toBe("ready");
    expect(seen).toContain("loading");
    expect(createFromOptions).toHaveBeenCalledTimes(1);
    expect(createFromOptions.mock.calls[0]).toEqual([
      {},
      { baseOptions: { modelAssetPath: "blob:model" }, maxTokens: 512, topK: 40, temperature: 0.6, randomSeed: 1 },
    ]);
  });

  it("generate runs the engine and queues calls", async () => {
    const { d, generateResponse } = deps();
    const g = createGemma(d);
    await g.importFile(new File(["w"], MODEL_FILE));
    const [a, b] = await Promise.all([g.generate("a"), g.generate("b")]);
    expect([a, b]).toEqual(["echo:a", "echo:b"]);
    expect(generateResponse).toHaveBeenCalledTimes(2);
  });

  it("refresh loads a model already in OPFS", async () => {
    const { d, files } = deps();
    files.set(MODEL_FILE, new Blob(["w"]));
    const g = createGemma(d);
    await g.refresh();
    expect(g.status().state).toBe("ready");
  });

  it("remove makes it absent", async () => {
    const { d, files } = deps();
    const g = createGemma(d);
    await g.importFile(new File(["w"], MODEL_FILE));
    await g.remove();
    expect(g.status().state).toBe("absent");
    expect(files.has(MODEL_FILE)).toBe(false);
  });

  it("goes to error when the engine fails", async () => {
    const { d } = deps({
      genai: async () => ({
        FilesetResolver: { forGenAiTasks: async () => ({}) },
        LlmInference: { createFromOptions: async () => Promise.reject(new Error("no adapter")) },
      }),
    });
    const g = createGemma(d);
    await expect(g.importFile(new File(["w"], MODEL_FILE))).rejects.toThrow("no adapter");
    expect(g.status()).toEqual({ state: "error", reason: "no adapter" });
  });
});
