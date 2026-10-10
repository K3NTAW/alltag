// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SceneResult, TurnRequest } from "../src/lib/types";
import { createHandler, type Generate } from "./turn";

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
    {
      id: "o2",
      fr: "croissant",
      en: "croissant",
      article: "le",
      gender: "m",
      plural: "croissants",
      level: "A1",
      phrase_fr: "Le croissant est frais.",
      phrase_en: "The croissant is fresh.",
    },
  ],
};

const request: TurnRequest = {
  scene,
  history: [{ role: "tutor", text: "Bonjour, vous désirez ?" }],
  userText: "Je voudrais un café, s'il vous plaît.",
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

describe("api/turn", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the TurnResponse from the generator", async () => {
    const reply = { reply_fr: "Très bien.", reply_en: "Very good.", task_done: true };
    const out = await call(request, async () => JSON.stringify(reply));
    expect(out.code).toBe(200);
    expect(out.body).toEqual(reply);
  });

  it("puts objects, history and userText in the prompt", async () => {
    let prompt = "";
    let system = "";
    await call(request, async (args) => {
      prompt = args.user;
      system = args.system;
      return JSON.stringify({ reply_fr: "a", reply_en: "b", task_done: false });
    });
    for (const o of scene.objects) expect(prompt).toContain(o.fr);
    expect(prompt).toContain(request.userText);
    expect(prompt).toContain("tutor: Bonjour, vous désirez ?");
    expect(system).toContain("Noé");
  });

  it("400 on missing userText", async () => {
    const out = await call({ ...request, userText: undefined }, async () => "{}");
    expect(out.code).toBe(400);
    expect(out.body).toHaveProperty("error");
  });

  it("502 when task_done is not boolean", async () => {
    const out = await call(request, async () =>
      JSON.stringify({ reply_fr: "a", reply_en: "b", task_done: "yes" }),
    );
    expect(out.code).toBe(502);
    expect(out.body).toHaveProperty("error");
  });
});
