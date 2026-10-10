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

export const DEFAULT_GRADER_MODEL = "gemini-3.1-pro-preview";
export const FALLBACK_GRADER_MODEL = "gemini-3.8-flash";
export const GRADER_TIMEOUT_MS = 8000;

export function graderModel(): string {
  return (
    process.env.GEMINI_MODEL_GRADER ??
    process.env.GEMINI_MODEL ??
    DEFAULT_GRADER_MODEL
  );
}

export type Generate = (args: {
  model: string;
  system: string;
  user: string;
  responseSchema: unknown;
  signal?: AbortSignal;
}) => Promise<string | undefined>;

async function geminiGenerate({
  model,
  system,
  user,
  responseSchema,
  signal,
}: Parameters<Generate>[0]): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: user }] }],
    config: {
      abortSignal: signal,
      systemInstruction: system,
      responseMimeType: "application/json",
      responseSchema,
    },
  });
  return response.text;
}

// Races the primary call against the timeout and aborts it when the timer wins.
async function withTimeout(
  generate: Generate,
  args: Omit<Parameters<Generate>[0], "signal">,
  ms: number,
): Promise<string | undefined> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("grader_timeout"));
    }, ms);
  });
  try {
    return await Promise.race([
      generate({ ...args, signal: controller.signal }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
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

export function createHandler(deps: { generate: Generate; timeoutMs?: number }) {
  const timeoutMs = deps.timeoutMs ?? GRADER_TIMEOUT_MS;
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
    const args = { system, user, responseSchema: CORRECT_SCHEMA };
    let modelUsed = graderModel();
    let text: string | undefined;
    try {
      text = await withTimeout(
        deps.generate,
        { ...args, model: modelUsed },
        timeoutMs,
      );
    } catch {
      modelUsed = FALLBACK_GRADER_MODEL;
      try {
        text = await deps.generate({ ...args, model: modelUsed });
      } catch {
        res.status(502).json({ error: "generation_failed" });
        return;
      }
    }
    const out = parseCorrect(text);
    if (!out) {
      res.status(502).json({ error: "bad_output" });
      return;
    }
    res.status(200).json({ ...out, model_used: modelUsed });
  };
}

export default createHandler({ generate: geminiGenerate });
