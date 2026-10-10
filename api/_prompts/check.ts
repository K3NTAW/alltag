import { Type } from "@google/genai";
import type { Level } from "../../src/lib/types";

export const CHECK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    grade: { type: Type.INTEGER, minimum: 0, maximum: 5 },
    correct: { type: Type.BOOLEAN },
    note_en: { type: Type.STRING },
  },
  required: ["grade", "correct", "note_en"],
};

export function buildCheckPrompt({
  target_fr,
  transcript,
  level,
}: {
  target_fr: string;
  transcript: string;
  level: Level;
}): { system: string; user: string } {
  const system = [
    "You check a spoken French review answer against a target phrase.",
    "The transcript comes from speech-to-text, so ignore punctuation and capitalisation.",
    "Be lenient: filler words (euh, ben, alors, bon) and hesitations do not count against the learner.",
    "Accents and articles do count: a wrong or missing article, or a wrong gender, is an error.",
    "grade is an SM-2 score from 0 to 5:",
    "5 exact or only filler differences; 4 correct with a small slip; 3 understandable with one real error;",
    "2 several errors but the key word is there; 1 mostly wrong; 0 nothing usable or empty.",
    "correct is true when grade is 3 or more.",
    "note_en is one short English sentence naming the main error, or praise when there is none.",
    `The learner's level is ${level}.`,
  ].join("\n");

  const user = [`Target: ${target_fr}`, `Learner said: ${transcript}`].join("\n");

  return { system, user };
}
