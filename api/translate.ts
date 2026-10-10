import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_lib/cors.js";
import { GoogleGenAI } from "@google/genai";
import type { TranslateRequest } from "../src/lib/types";
import { buildTranslatePrompt } from "./_prompts/translate.js";

export const DEFAULT_TRANSLATE_MODEL = "gemini-3.5-flash-lite";

export function translateModel(): string {
  return process.env.GEMINI_MODEL_TRANSLATE || DEFAULT_TRANSLATE_MODEL;
}

export type Generate = (args: { model: string; system: string; user: string }) => Promise<string | undefined>;

async function geminiGenerate({ model, system, user }: Parameters<Generate>[0]): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: user }] }],
    config: { systemInstruction: system },
  });
  return response.text;
}

/** One line, no wrapping quotes. */
function cleanLine(text: string | undefined): string {
  const line = (text ?? "").trim().split("\n")[0]?.trim() ?? "";
  return line.replace(/^["'«“]+|["'»”]+$/g, "").trim();
}

export function createHandler(deps: { generate: Generate }) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (applyCors(req, res)) return;
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const body = (req.body ?? {}) as Partial<TranslateRequest>;
    if (
      typeof body.text !== "string" ||
      !body.text.trim() ||
      (body.from !== undefined && body.from !== "fr") ||
      (body.to !== undefined && body.to !== "en")
    ) {
      res.status(400).json({ error: "missing text, or unsupported from/to" });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "missing_key" });
      return;
    }
    const { system, user } = buildTranslatePrompt({ text: body.text.trim() });
    let text: string | undefined;
    try {
      text = await deps.generate({ model: translateModel(), system, user });
    } catch {
      res.status(502).json({ error: "generation_failed" });
      return;
    }
    res.status(200).json({ text: cleanLine(text) });
  };
}

export default createHandler({ generate: geminiGenerate });
