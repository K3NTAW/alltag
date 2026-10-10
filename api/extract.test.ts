// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ExtractRequest } from "../src/lib/types";
import { createHandler, type Generate } from "./extract";
import { buildExtractPrompt } from "./_prompts/extract";

const request: ExtractRequest = {
  lines: [
    { fr: "On se retrouve à la gare ?", en: "Shall we meet at the station?" },
    { fr: "Ça marche, à tout à l'heure.", en: "Works for me, see you later." },
    { fr: "Ça marche.", en: "Works for me." },
  ],
  level: "A2",
  knownWords: ["gare", "bonjour"],
};

const fixture = {
  keep: [
    { fr: "ça marche", en: "works for me", why: "heard twice, an everyday yes", type: "expression" },
    { fr: "à tout à l'heure", en: "see you later", why: "a common goodbye", type: "phrase" },
    { fr: "se retrouver", en: "to meet up", why: "for making plans", type: "word", noun_fr: "" },
    { fr: "le quai", en: "the platform", why: "stations", type: "word", noun_fr: "quai" },
    { fr: "Gare", en: "station", why: "already known", type: "word" },
    { fr: "x", en: "y", why: "bad type", type: "idiom" },
    { fr: "a", en: "a", why: "", type: "word" },
    { fr: "b", en: "b", why: "", type: "word" },
    { fr: "c", en: "c", why: "", type: "word" },
  ],
  known: ["gare", 3],
  advanced: [{ fr: "Il eût fallu qu'on partît plus tôt.", en: "We should have left earlier." }, { fr: 1 }],
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
  await createHandler({ generate })({ method: "POST", body } as VercelRequest, res);
  return out;
}

describe("api/extract", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    vi.stubEnv("GEMINI_MODEL_EXTRACT", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses the fixture into keep (max 6, valid types, no known words), known and advanced", async () => {
    const generate = vi.fn<Generate>(async () => JSON.stringify(fixture));
    const out = await call(request, generate);
    expect(out.code).toBe(200);
    expect(out.body).toEqual({
      keep: [
        { fr: "ça marche", en: "works for me", why: "heard twice, an everyday yes", type: "expression" },
        { fr: "à tout à l'heure", en: "see you later", why: "a common goodbye", type: "phrase" },
        { fr: "se retrouver", en: "to meet up", why: "for making plans", type: "word" },
        { fr: "le quai", en: "the platform", why: "stations", type: "word", noun_fr: "quai" },
        { fr: "a", en: "a", why: "", type: "word" },
        { fr: "b", en: "b", why: "", type: "word" },
      ],
      known: ["gare"],
      advanced: [{ fr: "Il eût fallu qu'on partît plus tôt.", en: "We should have left earlier." }],
    });
  });

  it("uses gemini-3.8-flash by default, GEMINI_MODEL_EXTRACT when set, and a JSON schema", async () => {
    const generate = vi.fn<Generate>(async () => JSON.stringify({ keep: [], known: [], advanced: [] }));
    await call(request, generate);
    expect(generate.mock.calls[0][0].model).toBe("gemini-3.8-flash");
    expect(generate.mock.calls[0][0].responseSchema).toBeTruthy();
    vi.stubEnv("GEMINI_MODEL_EXTRACT", "gemini-y");
    await call(request, generate);
    expect(generate.mock.calls[1][0].model).toBe("gemini-y");
  });

  it("answers 400 on bad input", async () => {
    const generate = vi.fn<Generate>(async () => "{}");
    expect((await call({ ...request, lines: [] }, generate)).code).toBe(400);
    expect((await call({ ...request, lines: [{ fr: 1 }] }, generate)).code).toBe(400);
    expect((await call({ ...request, level: "C2" }, generate)).code).toBe(400);
    expect((await call({ ...request, knownWords: "gare" }, generate)).code).toBe(400);
    expect((await call(undefined, generate)).code).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it("answers 502 on unparseable output", async () => {
    expect((await call(request, async () => "not json")).code).toBe(502);
    expect((await call(request, async () => JSON.stringify({ known: [] }))).code).toBe(502);
  });

  it("states level, the 6 item cap, repeats and known words in the prompt", () => {
    const { system, user } = buildExtractPrompt(request);
    expect(system).toContain("A2 or one step above (B1)");
    expect(system).toContain("at most 6");
    expect(system).toContain("heard twice");
    expect(user).toContain("gare, bonjour");
    expect(user).toContain("Ça marche.");
  });
});
