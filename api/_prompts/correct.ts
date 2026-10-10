import { Type } from "@google/genai";
import type { Level, SceneResult } from "../../src/lib/types";

export const CORRECTION_TYPES = [
  "article",
  "gender",
  "case",
  "tense",
  "word_order",
  "vocab",
  "register",
] as const;

export const CORRECT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    corrections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          said: { type: Type.STRING },
          better: { type: Type.STRING },
          type: { type: Type.STRING, enum: [...CORRECTION_TYPES] },
          why_en: { type: Type.STRING },
        },
        required: ["said", "better", "type", "why_en"],
      },
    },
    kept_phrase_fr: { type: Type.STRING },
  },
  required: ["corrections", "kept_phrase_fr"],
};

export function buildCorrectPrompt({
  scene,
  userText,
  level,
}: {
  scene: SceneResult;
  userText: string;
  level: Level;
}): { system: string; user: string } {
  const system = [
    "You are a French grader. You are not a tutor and you do not play a character.",
    "Return only real errors in the learner's sentence.",
    `Each correction has type exactly one of: ${CORRECTION_TYPES.join("|")}.`,
    "why_en is one short English sentence.",
    "better is the minimal corrected fragment replacing said.",
    "kept_phrase_fr is the whole learner sentence corrected, natural, worth memorising.",
    "Return an empty corrections array when the sentence is fine.",
    `The learner's level is ${level}.`,
  ].join("\n");

  const objects = scene.objects
    .map((o) => `- ${o.article} ${o.fr} (${o.gender})`)
    .join("\n");
  const user = [
    `Place: ${scene.place}`,
    "Objects:",
    objects,
    "",
    `Learner's sentence: ${userText}`,
  ].join("\n");

  return { system, user };
}
