import { Type } from "@google/genai";
import type { Level } from "../../src/lib/types";

export const EXTRACT_TYPES = ["phrase", "expression", "word"] as const;
export const MAX_KEEP = 6;

export const EXTRACT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    keep: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fr: { type: Type.STRING },
          en: { type: Type.STRING },
          why: { type: Type.STRING },
          type: { type: Type.STRING, enum: [...EXTRACT_TYPES] },
          noun_fr: { type: Type.STRING },
        },
        required: ["fr", "en", "why", "type"],
      },
    },
    known: { type: Type.ARRAY, items: { type: Type.STRING } },
    advanced: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { fr: { type: Type.STRING }, en: { type: Type.STRING } },
        required: ["fr", "en"],
      },
    },
  },
  required: ["keep", "known", "advanced"],
};

const NEXT: Record<Level, Level> = { A1: "A2", A2: "B1", B1: "B2", B2: "B2" };

export function buildExtractPrompt({
  lines,
  level,
  knownWords,
}: {
  lines: { fr: string; en: string }[];
  level: Level;
  knownWords: string[];
}): { system: string; user: string } {
  const system = [
    "You pick what a French learner should learn from a real conversation they overheard.",
    `The learner's level is ${level}. Pick items at ${level} or one step above (${NEXT[level]}), never harder.`,
    `keep: at most ${MAX_KEEP} items worth learning, best first. Prefer lines or chunks heard twice or more.`,
    "Each keep item: fr is a short reusable phrase, expression or word taken from the conversation;",
    "en is its natural English; why is one short English line on why it is useful;",
    "type is exactly one of phrase|expression|word; noun_fr is the head noun without article when there is one.",
    "Never pick anything in the known words list.",
    "known: words or phrases from the conversation the learner already knows (from the known words list).",
    "advanced: lines that are too hard for now, with fr and en.",
    "Return JSON only.",
  ].join("\n");
  const known = knownWords.length ? knownWords.join(", ") : "(none yet)";
  const user = [
    `Known words: ${known}`,
    "",
    "Conversation:",
    ...lines.map((l, i) => `${i + 1}. ${l.fr} | ${l.en}`),
  ].join("\n");
  return { system, user };
}
