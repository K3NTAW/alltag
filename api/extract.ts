import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import type { ExtractItem, ExtractRequest, ExtractResponse, ExtractType, Level } from "../src/lib/types";
import { EXTRACT_SCHEMA, EXTRACT_TYPES, MAX_KEEP, buildExtractPrompt } from "./_prompts/extract";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];
export const DEFAULT_EXTRACT_MODEL = "gemini-3.8-flash";

export function extractModel(): string {
  return process.env.GEMINI_MODEL_EXTRACT || DEFAULT_EXTRACT_MODEL;
}

export type Generate = (args: {
  model: string;
  system: string;
  user: string;
  responseSchema: unknown;
}) => Promise<string | undefined>;

async function geminiGenerate({ model, system, user, responseSchema }: Parameters<Generate>[0]): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: user }] }],
    config: { systemInstruction: system, responseMimeType: "application/json", responseSchema },
  });
  return response.text;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

function isLine(v: unknown): v is { fr: string; en: string } {
  return isObj(v) && isStr(v.fr) && typeof v.en === "string";
}

function parseExtract(text: string | undefined, knownWords: string[]): ExtractResponse | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(data) || !Array.isArray(data.keep)) return null;
  const known = new Set(knownWords.map((w) => w.trim().toLowerCase()));
  const keep: ExtractItem[] = [];
  for (const k of data.keep) {
    if (!isObj(k) || !isStr(k.fr) || !isStr(k.en) || typeof k.why !== "string") continue;
    if (!(EXTRACT_TYPES as readonly string[]).includes(k.type as string)) continue;
    if (known.has(k.fr.trim().toLowerCase())) continue;
    const item: ExtractItem = { fr: k.fr, en: k.en, why: k.why, type: k.type as ExtractType };
    if (isStr(k.noun_fr)) item.noun_fr = k.noun_fr;
    keep.push(item);
    if (keep.length === MAX_KEEP) break;
  }
  return {
    keep,
    known: Array.isArray(data.known) ? data.known.filter(isStr) : [],
    advanced: Array.isArray(data.advanced) ? data.advanced.filter(isLine).map(({ fr, en }) => ({ fr, en })) : [],
  };
}

export function createHandler(deps: { generate: Generate }) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const body = (req.body ?? {}) as Partial<ExtractRequest>;
    const knownWords = body.knownWords ?? [];
    if (
      !Array.isArray(body.lines) ||
      body.lines.length === 0 ||
      !body.lines.every(isLine) ||
      !LEVELS.includes(body.level as Level) ||
      !Array.isArray(knownWords) ||
      !knownWords.every((w) => typeof w === "string")
    ) {
      res.status(400).json({ error: "missing lines or level, or bad knownWords" });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "missing_key" });
      return;
    }
    const { system, user } = buildExtractPrompt({ lines: body.lines, level: body.level as Level, knownWords });
    let text: string | undefined;
    try {
      text = await deps.generate({ model: extractModel(), system, user, responseSchema: EXTRACT_SCHEMA });
    } catch {
      res.status(502).json({ error: "generation_failed" });
      return;
    }
    const out = parseExtract(text, knownWords);
    if (!out) {
      res.status(502).json({ error: "bad_output" });
      return;
    }
    res.status(200).json(out);
  };
}

export default createHandler({ generate: geminiGenerate });
