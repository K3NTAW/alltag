// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SceneResult } from "../src/lib/types";
import handler, { createHandler, validateScene, type GenerateArgs } from "./scene";
import { buildScenePrompt } from "./_prompts/scene";

const fixture: SceneResult = {
  place: "un café",
  objects: [
    {
      id: "cup",
      fr: "tasse",
      en: "cup",
      article: "la",
      gender: "f",
      plural: "tasses",
      level: "A1",
      phrase_fr: "Une tasse de café, s'il vous plaît.",
      phrase_en: "A cup of coffee, please.",
      bbox: [0.1, 0.2, 0.3, 0.4],
    },
    {
      id: "table",
      fr: "table",
      en: "table",
      article: "la",
      gender: "f",
      plural: "tables",
      level: "A1",
      phrase_fr: "Cette table est libre ?",
      phrase_en: "Is this table free?",
    },
    {
      id: "menu",
      fr: "menu",
      en: "menu",
      article: "le",
      gender: "m",
      plural: "menus",
      level: "A2",
      phrase_fr: "Je peux voir le menu ?",
      phrase_en: "Can I see the menu?",
      bbox: [0.5, 0.5, 0.2, 0.2],
    },
  ],
  task: { fr: "Commande un café.", en: "Order a coffee.", role: "barista" },
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

function req(method: string, body?: unknown) {
  return { method, body } as VercelRequest;
}

const goodBody = {
  imageBase64: "data:image/jpeg;base64,AAAA",
  level: "A2",
  knownWords: ["bonjour", "merci", "café"],
};

describe("api/scene", () => {
  it("returns 200 with the validated scene", async () => {
    let seen: GenerateArgs | undefined;
    const h = createHandler({
      generate: async (args) => {
        seen = args;
        return { text: JSON.stringify(fixture) };
      },
    });
    const { out, res } = mockRes();
    await h(req("POST", goodBody), res);
    expect(out.code).toBe(200);
    expect(out.body).toEqual(fixture);
    const part = seen!.contents[0].parts[0];
    expect("inlineData" in part && part.inlineData.data).toBe("AAAA");
  });

  it("passes level and every known word to the model", async () => {
    let prompt = "";
    const h = createHandler({
      generate: async (args) => {
        const texts = args.contents[0].parts.flatMap((p) =>
          "text" in p ? [p.text] : [],
        );
        prompt = [args.config.systemInstruction, ...texts].join("\n");
        return { text: JSON.stringify(fixture) };
      },
    });
    const { res } = mockRes();
    await h(req("POST", goodBody), res);
    expect(prompt).toContain("A2");
    for (const w of goodBody.knownWords) expect(prompt).toContain(w);
  });

  describe("model", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    async function seenModel() {
      let model = "";
      const h = createHandler({
        generate: async (args) => {
          model = args.model;
          return { text: JSON.stringify(fixture) };
        },
      });
      const { res } = mockRes();
      await h(req("POST", goodBody), res);
      return model;
    }

    it("defaults to gemini-3.8-flash", async () => {
      vi.stubEnv("GEMINI_MODEL_VISION", undefined);
      vi.stubEnv("GEMINI_MODEL", undefined);
      expect(await seenModel()).toBe("gemini-3.8-flash");
    });

    it("reads GEMINI_MODEL_VISION before the GEMINI_MODEL alias", async () => {
      vi.stubEnv("GEMINI_MODEL", "alias-model");
      expect(await seenModel()).toBe("alias-model");
      vi.stubEnv("GEMINI_MODEL_VISION", "vision-model");
      expect(await seenModel()).toBe("vision-model");
    });
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const h = createHandler({ generate: async () => ({ text: "{}" }) });
    const { out, res } = mockRes();
    await h(req("POST", { level: "A1", knownWords: [] }), res);
    expect(out.code).toBe(400);
    expect(out.body).toHaveProperty("error");
  });

  it("returns 405 on GET", async () => {
    const h = createHandler({ generate: async () => ({ text: "{}" }) });
    const { out, res } = mockRes();
    await h(req("GET"), res);
    expect(out.code).toBe(405);
  });

  it("returns 502 on unparsable model text", async () => {
    const h = createHandler({ generate: async () => ({ text: "not json" }) });
    const { out, res } = mockRes();
    await h(req("POST", goodBody), res);
    expect(out.code).toBe(502);
    expect(out.body).toEqual({ error: "bad_scene" });
  });

  it("returns 502 when the SDK throws", async () => {
    const h = createHandler({
      generate: async () => {
        throw new Error("boom");
      },
    });
    const { out, res } = mockRes();
    await h(req("POST", goodBody), res);
    expect(out.code).toBe(502);
  });

  it("default handler returns 500 missing_key without GEMINI_API_KEY", async () => {
    const prev = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const { out, res } = mockRes();
    await handler(req("POST", goodBody), res);
    expect(out.code).toBe(500);
    expect(out.body).toEqual({ error: "missing_key" });
    if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
  });
});

describe("validateScene", () => {
  it("accepts the fixture", () => {
    expect(validateScene(fixture)).toEqual(fixture);
  });

  it("rejects more than 6 objects", () => {
    const objects = Array.from({ length: 7 }, (_, i) => ({
      ...fixture.objects[1],
      id: `o${i}`,
    }));
    expect(() => validateScene({ ...fixture, objects })).toThrow();
  });

  it("rejects an invalid gender", () => {
    const objects = [{ ...fixture.objects[0], gender: "n" }];
    expect(() => validateScene({ ...fixture, objects })).toThrow();
  });
});

describe("buildScenePrompt", () => {
  it("mentions the 95 % rule, the 6 object cap and the level", () => {
    const { system, user } = buildScenePrompt({ level: "B1", knownWords: [] });
    const text = `${system}\n${user}`;
    expect(text).toContain("95");
    expect(text).toContain("6");
    expect(text).toContain("B1");
  });
});
