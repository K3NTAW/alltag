// Prompts sized for a 1B model: short, French, JSON only. The parsers assume the
// model will sometimes wrap the JSON in prose or not produce any.
import type {
  Correction,
  CorrectionType,
  CorrectRequest,
  CorrectResponse,
  TurnRequest,
  TurnResponse,
} from "../lib/types";

const TYPES: CorrectionType[] = ["article", "gender", "case", "tense", "word_order", "vocab", "register"];

function wrap(text: string): string {
  return `<start_of_turn>user\n${text}<end_of_turn>\n<start_of_turn>model\n`;
}

export function turnPrompt({ scene, history, userText, level }: TurnRequest): string {
  const lines = history
    .slice(-6)
    .map((m) => `${m.role === "tutor" ? "Noé" : "Élève"}: ${m.text}`)
    .join("\n");
  return wrap(
    [
      `Tu es Noé, ${scene.task.role} à ${scene.place}. Niveau ${level}: phrases très courtes et simples.`,
      `Tâche de l'élève: ${scene.task.fr}`,
      lines && `Conversation:\n${lines}`,
      `Élève: ${userText}`,
      `Réponds en une phrase, reste dans le rôle. task_done = true seulement si la tâche est finie.`,
      `Réponds uniquement en JSON: {"reply_fr": "...", "reply_en": "...", "task_done": false}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function correctPrompt({ scene, userText, level }: CorrectRequest): string {
  return wrap(
    [
      `Tu corriges le français d'un élève de niveau ${level}. Lieu: ${scene.place}.`,
      `Phrase de l'élève: "${userText}"`,
      `Donne au plus 2 corrections. type parmi: ${TYPES.join(", ")}. why_en en anglais, court.`,
      `Si la phrase est correcte, corrections = [].`,
      `Réponds uniquement en JSON: {"corrections": [{"said": "...", "better": "...", "type": "vocab", "why_en": "..."}], "kept_phrase_fr": "..."}`,
    ].join("\n"),
  );
}

/** The first balanced {...} block in raw, string-aware, or null. */
function firstObject(raw: string): unknown {
  for (let start = raw.indexOf("{"); start !== -1; start = raw.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const TURN_DEFAULT: TurnResponse = {
  reply_fr: "pardon, tu peux répéter ?",
  reply_en: "sorry, can you repeat?",
  task_done: false,
};

export function parseTurn(raw: string): TurnResponse {
  const o = firstObject(raw) as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !str(o.reply_fr)) return { ...TURN_DEFAULT };
  return { reply_fr: str(o.reply_fr), reply_en: str(o.reply_en), task_done: o.task_done === true };
}

export function parseCorrect(raw: string): CorrectResponse {
  const o = firstObject(raw) as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return { corrections: [], kept_phrase_fr: "" };
  const list = Array.isArray(o.corrections) ? o.corrections : [];
  const corrections: Correction[] = [];
  for (const c of list as Record<string, unknown>[]) {
    if (!c || typeof c !== "object") continue;
    const type = c.type as CorrectionType;
    if (!str(c.said) || !str(c.better) || !TYPES.includes(type) || str(c.said) === str(c.better)) continue;
    corrections.push({ said: str(c.said), better: str(c.better), type, why_en: str(c.why_en) });
  }
  return { corrections, kept_phrase_fr: str(o.kept_phrase_fr) };
}
