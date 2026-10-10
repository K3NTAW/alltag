import { Type } from "@google/genai";
import type { Level } from "../../src/lib/types";

const LEVELS = ["A1", "A2", "B1", "B2"];
const MAX_KNOWN_WORDS = 200;

export const SCENE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    place: { type: Type.STRING },
    objects: {
      type: Type.ARRAY,
      minItems: "1",
      maxItems: "6",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          fr: { type: Type.STRING },
          en: { type: Type.STRING },
          article: { type: Type.STRING },
          gender: { type: Type.STRING, enum: ["m", "f"] },
          plural: { type: Type.STRING },
          level: { type: Type.STRING, enum: LEVELS },
          phrase_fr: { type: Type.STRING },
          phrase_en: { type: Type.STRING },
          bbox: {
            type: Type.ARRAY,
            minItems: "4",
            maxItems: "4",
            items: { type: Type.NUMBER },
          },
        },
        required: [
          "id",
          "fr",
          "en",
          "article",
          "gender",
          "plural",
          "level",
          "phrase_fr",
          "phrase_en",
        ],
      },
    },
    task: {
      type: Type.OBJECT,
      properties: {
        fr: { type: Type.STRING },
        en: { type: Type.STRING },
        role: { type: Type.STRING },
      },
      required: ["fr", "en", "role"],
    },
  },
  required: ["place", "objects", "task"],
};

export function buildScenePrompt({
  level,
  knownWords,
}: {
  level: Level;
  knownWords: string[];
}): { system: string; user: string } {
  const known = knownWords.slice(0, MAX_KNOWN_WORDS).join(", ");
  const system = [
    "You are a French tutor looking at a photo the learner just took.",
    "Target language: French. The learner's native language: English.",
    `Learner level: ${level} (CEFR).`,
    "Name at most 6 useful objects visible in the frame. Tag each object with a CEFR level from A1 to B2.",
    "For each object give the French noun, the English noun, the article, the gender (m or f), the plural, and one useful short phrase_fr with its English translation phrase_en.",
    "Follow the 95 % rule: 95 % of the words in the phrases must be in the known-words list or at A1 level, with at most 2 new items per phrase.",
    "Give bbox as [x, y, w, h], each a fraction from 0 to 1 of the image width and height.",
    "Give place as one short French noun phrase (for example: un café, une cuisine).",
    "Give task as one short roleplay task that fits the place, in French (fr) and English (en), with role = the person the tutor plays (barista, flatmate, shopkeeper...).",
    "Reply with JSON only, matching the schema.",
  ].join("\n");
  const user = [
    `Learner level: ${level}.`,
    `Known words: ${known || "(none yet)"}.`,
    "Describe this scene.",
  ].join("\n");
  return { system, user };
}
