import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import type {
  Level,
  SceneObject,
  SceneRequest,
  SceneResult,
} from "../src/lib/types";
import { applyCors } from "./_lib/cors";
import { SCENE_SCHEMA, buildScenePrompt } from "./_prompts/scene";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];
const DATA_PREFIX = "data:image/jpeg;base64,";
export const DEFAULT_VISION_MODEL = "gemini-3.8-flash";

export function visionModel(): string {
  return (
    process.env.GEMINI_MODEL_VISION ??
    process.env.GEMINI_MODEL ??
    DEFAULT_VISION_MODEL
  );
}

export interface GenerateArgs {
  model: string;
  contents: {
    role: "user";
    parts: (
      | { inlineData: { mimeType: string; data: string } }
      | { text: string }
    )[];
  }[];
  config: {
    systemInstruction: string;
    responseMimeType: "application/json";
    responseSchema: typeof SCENE_SCHEMA;
  };
}

export interface SceneDeps {
  generate: (args: GenerateArgs) => Promise<{ text?: string }>;
}

function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (LEVELS as string[]).includes(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(msg: string): never {
  throw new Error(`invalid scene: ${msg}`);
}

function str(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (typeof v !== "string") fail(`${key} must be a string`);
  return v;
}

function validateObject(v: unknown, i: number): SceneObject {
  if (!isRecord(v)) fail(`objects[${i}] must be an object`);
  const gender = v.gender;
  if (gender !== "m" && gender !== "f") fail(`objects[${i}].gender`);
  if (!isLevel(v.level)) fail(`objects[${i}].level`);
  const obj: SceneObject = {
    id: str(v, "id"),
    fr: str(v, "fr"),
    en: str(v, "en"),
    article: str(v, "article"),
    gender,
    plural: str(v, "plural"),
    level: v.level,
    phrase_fr: str(v, "phrase_fr"),
    phrase_en: str(v, "phrase_en"),
  };
  if (v.bbox !== undefined) {
    const b = v.bbox;
    if (
      !Array.isArray(b) ||
      b.length !== 4 ||
      !b.every((n) => typeof n === "number" && n >= 0 && n <= 1)
    ) {
      fail(`objects[${i}].bbox`);
    }
    obj.bbox = [b[0], b[1], b[2], b[3]];
  }
  return obj;
}

export function validateScene(value: unknown): SceneResult {
  if (!isRecord(value)) fail("not an object");
  const place = str(value, "place");
  const objects = value.objects;
  if (!Array.isArray(objects) || objects.length < 1 || objects.length > 6) {
    fail("objects must have 1..6 items");
  }
  const task = value.task;
  if (!isRecord(task)) fail("task must be an object");
  return {
    place,
    objects: objects.map(validateObject),
    task: { fr: str(task, "fr"), en: str(task, "en"), role: str(task, "role") },
  };
}

export function createHandler(deps: SceneDeps) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const body = (isRecord(req.body) ? req.body : {}) as Partial<SceneRequest>;
    if (typeof body.imageBase64 !== "string" || body.imageBase64 === "") {
      res.status(400).json({ error: "imageBase64 required" });
      return;
    }
    if (!isLevel(body.level)) {
      res.status(400).json({ error: "level must be A1..B2" });
      return;
    }
    const knownWords = Array.isArray(body.knownWords)
      ? body.knownWords.filter((w): w is string => typeof w === "string")
      : [];
    const data = body.imageBase64.startsWith(DATA_PREFIX)
      ? body.imageBase64.slice(DATA_PREFIX.length)
      : body.imageBase64;
    const { system, user } = buildScenePrompt({ level: body.level, knownWords });

    let text: string | undefined;
    try {
      const response = await deps.generate({
        model: visionModel(),
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data } },
              { text: user },
            ],
          },
        ],
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseSchema: SCENE_SCHEMA,
        },
      });
      text = response.text;
    } catch {
      res.status(502).json({ error: "upstream_error" });
      return;
    }

    let scene: SceneResult;
    try {
      scene = validateScene(JSON.parse(text ?? ""));
    } catch {
      res.status(502).json({ error: "bad_scene" });
      return;
    }
    res.status(200).json(scene);
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "missing_key" });
    return;
  }
  const ai = new GoogleGenAI({ apiKey });
  return createHandler({
    generate: (args) => ai.models.generateContent(args),
  })(req, res);
}
