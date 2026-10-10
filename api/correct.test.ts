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
    });
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
