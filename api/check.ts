import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import type { CheckRequest, CheckResponse } from "../src/lib/api";
import type { Level } from "../src/lib/types";
import { CHECK_SCHEMA, buildCheckPrompt } from "./_prompts/check";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];
export const DEFAULT_CHECK_MODEL = "gemini-3.5-flash-lite";

export function checkModel(): string {
  return (
    process.env.GEMINI_MODEL_CHECK ?? process.env.GEMINI_MODEL ?? DEFAULT_CHECK_MODEL
  );
}

export type Generate = (args: {
  model: string;
  system: string;
  user: string;
  responseSchema: unknown;
}) => Promise<string | undefined>;

async function geminiGenerate({
  model,
  system,
  user,
  responseSchema,
}: Parameters<Generate>[0]): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: user }] }],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseSchema,
    },
  });
  return response.text;
}

function parseCheck(text: string | undefined): CheckResponse | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (
    typeof d.grade !== "number" ||
    !Number.isInteger(d.grade) ||
    d.grade < 0 ||
    d.grade > 5 ||
    typeof d.correct !== "boolean" ||
    typeof d.note_en !== "string"
  ) {
    return null;
  }
  return {
    grade: d.grade as CheckResponse["grade"],
    correct: d.correct,
    note_en: d.note_en,
  };
}

export function createHandler(deps: { generate: Generate }) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const body = (req.body ?? {}) as Partial<CheckRequest>;
    if (
      typeof body.target_fr !== "string" ||
      !body.target_fr ||
      typeof body.transcript !== "string" ||
      !LEVELS.includes(body.level as Level)
    ) {
      res.status(400).json({ error: "missing target_fr, transcript or level" });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "missing_key" });
      return;
    }
    const { system, user } = buildCheckPrompt({
      target_fr: body.target_fr,
      transcript: body.transcript,
      level: body.level as Level,
    });
    let text: string | undefined;
    try {
      text = await deps.generate({
        model: checkModel(),
        system,
        user,
        responseSchema: CHECK_SCHEMA,
      });
    } catch {
      res.status(502).json({ error: "generation_failed" });
      return;
    }
    const out = parseCheck(text);
    if (!out) {
      res.status(502).json({ error: "bad_output" });
      return;
    }
    res.status(200).json(out);
  };
}

export default createHandler({ generate: geminiGenerate });
