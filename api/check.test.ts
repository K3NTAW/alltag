// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { CheckRequest } from "../src/lib/api";
import { createHandler, type Generate } from "./check";
import { buildCheckPrompt } from "./_prompts/check";

const request: CheckRequest = {
  target_fr: "Une tasse de café, s'il vous plaît.",
  transcript: "euh une tasse de café s'il vous plaît",
  level: "A1",
};

const fixture = { grade: 5, correct: true, note_en: "Perfect." };

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

describe("api/check", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns grade, correct and note_en from the generator", async () => {
    let prompt = "";
    const out = await call(request, async (args) => {
      prompt = args.user;
      return JSON.stringify(fixture);
    });
    expect(out.code).toBe(200);
    expect(out.body).toEqual(fixture);
    expect(prompt).toContain(request.target_fr);
    expect(prompt).toContain(request.transcript);
  });

  it("model defaults to gemini-3.5-flash-lite", async () => {
    vi.stubEnv("GEMINI_MODEL_CHECK", undefined);
    vi.stubEnv("GEMINI_MODEL", undefined);
    let model = "";
    await call(request, async (args) => {
      model = args.model;
      return JSON.stringify(fixture);
    });
    expect(model).toBe("gemini-3.5-flash-lite");
  });

  it("model reads GEMINI_MODEL_CHECK before the GEMINI_MODEL alias", async () => {
    let model = "";
    const generate: Generate = async (args) => {
      model = args.model;
      return JSON.stringify(fixture);
    };
    vi.stubEnv("GEMINI_MODEL", "alias-model");
    await call(request, generate);
    expect(model).toBe("alias-model");
    vi.stubEnv("GEMINI_MODEL_CHECK", "check-model");
    await call(request, generate);
    expect(model).toBe("check-model");
  });

  it("400 on missing target_fr", async () => {
    const out = await call({ ...request, target_fr: undefined }, async () => "{}");
    expect(out.code).toBe(400);
    expect(out.body).toHaveProperty("error");
  });

  it("502 when grade is out of range", async () => {
    const out = await call(request, async () =>
      JSON.stringify({ ...fixture, grade: 6 }),
    );
    expect(out.code).toBe(502);
  });

  it("prompt counts accents and articles, not filler words", () => {
    const { system } = buildCheckPrompt(request);
    expect(system).toMatch(/filler/i);
    expect(system).toMatch(/accents/i);
    expect(system).toMatch(/article/i);
  });
});
