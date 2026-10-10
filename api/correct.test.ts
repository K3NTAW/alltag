// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { CorrectRequest, SceneResult } from "../src/lib/types";
import { createHandler, type Generate } from "./correct";
import { buildCorrectPrompt } from "./_prompts/correct";
import { buildTurnPrompt } from "./_prompts/turn";

const scene: SceneResult = {
  place: "un café",
  task: { fr: "Commande un café.", en: "Order a coffee.", role: "barista" },
  objects: [
    {
      id: "o1",
      fr: "tasse",
      en: "cup",
      article: "la",
      gender: "f",
      plural: "tasses",
      level: "A1",
      phrase_fr: "La tasse est chaude.",
      phrase_en: "The cup is hot.",
    },
  ],
};

const request: CorrectRequest = {
  scene,
  userText: "Je voudrais le tasse.",
  level: "A1",
};

function mockRes() {
  const out = { code: 0, body: undefined as unknown };
  const res = {
    status(c: number) {
      out.code = c;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
  };
  return { out, res: res as unknown as VercelResponse };
}

async function call(body: unknown, generate: Generate) {
  const { out, res } = mockRes();
  await createHandler({ generate })(
    { method: "POST", body } as VercelRequest,
    res,
  );
  return out;
}

describe("api/correct", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("drops corrections with an invalid type and keeps kept_phrase_fr", async () => {
    const valid = {
      said: "le tasse",
      better: "la tasse",
      type: "gender",
      why_en: "Tasse is feminine.",
    };
    const out = await call(request, async () =>
      JSON.stringify({
        corrections: [
          valid,
          { said: "x", better: "y", type: "spelling", why_en: "Nope." },
        ],
        kept_phrase_fr: "Je voudrais la tasse.",
      }),
    );
    expect(out.code).toBe(200);
    expect(out.body).toEqual({
      corrections: [valid],
      kept_phrase_fr: "Je voudrais la tasse.",
      model_used: "gemini-3.1-pro-preview",
    });
  });

  const good = JSON.stringify({ corrections: [], kept_phrase_fr: "Je voudrais la tasse." });

  it("model defaults to gemini-3.1-pro-preview", async () => {
    vi.stubEnv("GEMINI_MODEL_GRADER", undefined);
    vi.stubEnv("GEMINI_MODEL", undefined);
    const models: string[] = [];
    const out = await call(request, async (args) => {
      models.push(args.model);
      return good;
    });
    expect(models).toEqual(["gemini-3.1-pro-preview"]);
    expect(out.body).toHaveProperty("model_used", "gemini-3.1-pro-preview");
  });

  it("model reads GEMINI_MODEL_GRADER before the GEMINI_MODEL alias", async () => {
    const models: string[] = [];
    const generate: Generate = async (args) => {
      models.push(args.model);
      return good;
    };
    vi.stubEnv("GEMINI_MODEL", "alias-model");
    await call(request, generate);
    vi.stubEnv("GEMINI_MODEL_GRADER", "grader-model");
    const out = await call(request, generate);
    expect(models).toEqual(["alias-model", "grader-model"]);
    expect(out.body).toHaveProperty("model_used", "grader-model");
  });

  it("falls back to gemini-3.8-flash when the grader errors", async () => {
    const models: string[] = [];
    const out = await call(request, async (args) => {
      models.push(args.model);
      if (args.model === "gemini-3.1-pro-preview") throw new Error("boom");
      return good;
    });
    expect(models).toEqual(["gemini-3.1-pro-preview", "gemini-3.8-flash"]);
    expect(out.code).toBe(200);
    expect(out.body).toHaveProperty("model_used", "gemini-3.8-flash");
  });

  it("falls back to gemini-3.8-flash and aborts the grader after 8 s", async () => {
    vi.useFakeTimers();
    try {
      const models: string[] = [];
      let aborted = false;
      const pending = call(request, (args) => {
        models.push(args.model);
        if (args.model === "gemini-3.8-flash") return Promise.resolve(good);
        args.signal?.addEventListener("abort", () => {
          aborted = true;
        });
        return new Promise<string>(() => {});
      });
      await vi.advanceTimersByTimeAsync(7999);
      expect(models).toEqual(["gemini-3.1-pro-preview"]);
      await vi.advanceTimersByTimeAsync(1);
      const out = await pending;
      expect(aborted).toBe(true);
      expect(models).toEqual(["gemini-3.1-pro-preview", "gemini-3.8-flash"]);
      expect(out.code).toBe(200);
      expect(out.body).toHaveProperty("model_used", "gemini-3.8-flash");
    } finally {
      vi.useRealTimers();
    }
  });

  it("502 when the fallback also errors", async () => {
    const out = await call(request, async () => {
      throw new Error("boom");
    });
    expect(out.code).toBe(502);
    expect(out.body).toEqual({ error: "generation_failed" });
  });

  it("400 on missing scene", async () => {
    const out = await call({ ...request, scene: undefined }, async () => "{}");
    expect(out.code).toBe(400);
    expect(out.body).toHaveProperty("error");
  });

  it("grader prompt has no Noé, turn prompt does", () => {
    const grader = buildCorrectPrompt(request);
    const turn = buildTurnPrompt({ ...request, history: [] });
    expect(grader.system).not.toContain("Noé");
    expect(turn.system).toContain("Noé");
  });
});
