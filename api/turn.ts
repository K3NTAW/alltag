import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import type { TurnRequest, TurnResponse } from "../src/lib/types";
import { TURN_SCHEMA, buildTurnPrompt } from "./_prompts/turn";

export const DEFAULT_TURN_MODEL = "gemini-3.8-flash";

export function turnModel(): string {
  return (
    process.env.GEMINI_MODEL_TURN ?? process.env.GEMINI_MODEL ?? DEFAULT_TURN_MODEL
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

function parseTurn(text: string | undefined): TurnResponse | null {
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
    typeof d.reply_fr !== "string" ||
    typeof d.reply_en !== "string" ||
    typeof d.task_done !== "boolean"
  ) {
    return null;
  }
  return { reply_fr: d.reply_fr, reply_en: d.reply_en, task_done: d.task_done };
}

export function createHandler(deps: { generate: Generate }) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const body = (req.body ?? {}) as Partial<TurnRequest>;
    if (
      !body.scene ||
      !Array.isArray(body.history) ||
      typeof body.userText !== "string" ||
      !body.userText ||
      !body.level
    ) {
      res.status(400).json({ error: "missing scene, history, userText or level" });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "missing_key" });
      return;
    }
    const { system, user } = buildTurnPrompt({
      scene: body.scene,
      history: body.history,
      userText: body.userText,
      level: body.level,
    });
    let text: string | undefined;
    try {
      text = await deps.generate({
        model: turnModel(),
        system,
        user,
        responseSchema: TURN_SCHEMA,
      });
    } catch {
      res.status(502).json({ error: "generation_failed" });
      return;
    }
    const out = parseTurn(text);
    if (!out) {
      res.status(502).json({ error: "bad_output" });
      return;
    }
    res.status(200).json(out);
  };
}

export default createHandler({ generate: geminiGenerate });
