import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import type {
  CorrectRequest,
  CorrectResponse,
  Correction,
  CorrectionType,
} from "../src/lib/types";
import {
  CORRECTION_TYPES,
  CORRECT_SCHEMA,
  buildCorrectPrompt,
} from "./_prompts/correct";

export type Generate = (args: {
  system: string;
  user: string;
  responseSchema: unknown;
}) => Promise<string | undefined>;

async function geminiGenerate({
  system,
  user,
  responseSchema,
}: Parameters<Generate>[0]): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: user }] }],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseSchema,
    },
  });
  return response.text;
}

function isCorrection(c: unknown): c is Correction {
  if (typeof c !== "object" || c === null) return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.said === "string" &&
    typeof o.better === "string" &&
    typeof o.why_en === "string" &&
    (CORRECTION_TYPES as readonly string[]).includes(o.type as string)
  );
}

function parseCorrect(text: string | undefined): CorrectResponse | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.corrections) || typeof d.kept_phrase_fr !== "string") {
    return null;
  }
  const corrections = d.corrections.filter(isCorrection).map((c) => ({
    said: c.said,
    better: c.better,
    type: c.type as CorrectionType,
    why_en: c.why_en,
  }));
  return { corrections, kept_phrase_fr: d.kept_phrase_fr };
}

export function createHandler(deps: { generate: Generate }) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const body = (req.body ?? {}) as Partial<CorrectRequest>;
    if (
      !body.scene ||
      typeof body.userText !== "string" ||
      !body.userText ||
      !body.level
    ) {
      res.status(400).json({ error: "missing scene, userText or level" });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "missing_key" });
      return;
    }
    const { system, user } = buildCorrectPrompt({
      scene: body.scene,
      userText: body.userText,
      level: body.level,
    });
    let text: string | undefined;
    try {
      text = await deps.generate({ system, user, responseSchema: CORRECT_SCHEMA });
    } catch {
      res.status(502).json({ error: "generation_failed" });
      return;
    }
    const out = parseCorrect(text);
    if (!out) {
      res.status(502).json({ error: "bad_output" });
      return;
    }
    res.status(200).json(out);
  };
}

export default createHandler({ generate: geminiGenerate });
