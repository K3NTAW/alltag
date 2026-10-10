// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHandler, type Generate } from "./translate";
import { buildTranslatePrompt } from "./_prompts/translate";

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

async function call(body: unknown, generate: Generate, method = "POST") {
  const { out, res } = mockRes();
  await createHandler({ generate })({ method, body } as VercelRequest, res);
  return out;
}

describe("api/translate", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    vi.stubEnv("GEMINI_MODEL_TRANSLATE", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses gemini-3.5-flash-lite by default and returns one clean line", async () => {
    const generate = vi.fn<Generate>(async () => '"See you tomorrow?"\n');
    const out = await call({ text: "On se voit demain ?", from: "fr", to: "en" }, generate);
    expect(out).toEqual({ code: 200, body: { text: "See you tomorrow?" } });
    expect(generate).toHaveBeenCalledWith({
      model: "gemini-3.5-flash-lite",
      ...buildTranslatePrompt({ text: "On se voit demain ?" }),
    });
  });

  it("reads the model from GEMINI_MODEL_TRANSLATE", async () => {
    vi.stubEnv("GEMINI_MODEL_TRANSLATE", "gemini-x");
    const generate = vi.fn<Generate>(async () => "Hi");
    await call({ text: "Salut", from: "fr", to: "en" }, generate);
    expect(generate.mock.calls[0][0].model).toBe("gemini-x");
  });

  it("answers 400 on empty or missing text and unsupported languages", async () => {
    const generate = vi.fn<Generate>(async () => "x");
    expect((await call({ text: "  ", from: "fr", to: "en" }, generate)).code).toBe(400);
    expect((await call({ from: "fr", to: "en" }, generate)).code).toBe(400);
    expect((await call(undefined, generate)).code).toBe(400);
    expect((await call({ text: "Hallo", from: "de", to: "en" }, generate)).code).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it("answers 405 on GET and 502 when generation fails", async () => {
    expect((await call({}, async () => "x", "GET")).code).toBe(405);
    const out = await call({ text: "Salut" }, async () => {
      throw new Error("down");
    });
    expect(out.code).toBe(502);
  });

  it("states the one-line rule in the prompt", () => {
    expect(buildTranslatePrompt({ text: "x" }).system).toContain("ONLY the English translation");
  });
});
