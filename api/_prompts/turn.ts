import { Type } from "@google/genai";
import type { Level, SceneResult, TurnMessage } from "../../src/lib/types";

export const TURN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply_fr: { type: Type.STRING },
    reply_en: { type: Type.STRING },
    task_done: { type: Type.BOOLEAN },
  },
  required: ["reply_fr", "reply_en", "task_done"],
};

export function buildTurnPrompt({
  scene,
  history,
  userText,
  level,
}: {
  scene: SceneResult;
  history: TurnMessage[];
  userText: string;
  level: Level;
}): { system: string; user: string } {
  const system = [
    `You are Noé, a calm barista in Zurich, playing the role "${scene.task.role}" in ${scene.place}.`,
    "Speak only French in reply_fr, at most 2 short sentences.",
    `Level ceiling: ${level}. Never use grammar or vocabulary above it.`,
    "Use the scene objects by their French names with their articles.",
    "Introduce at most 2 new words per turn.",
    "Never correct the learner mid-dialogue; just reply in character.",
    `Keep the task moving: ${scene.task.fr}`,
    "Set task_done true only when the learner has accomplished the task, otherwise false.",
    "reply_en is a plain English gloss of reply_fr.",
  ].join("\n");

  const objects = scene.objects
    .map((o) => `- ${o.article} ${o.fr} (${o.gender})`)
    .join("\n");
  const lines = history.map((m) => `${m.role}: ${m.text}`).join("\n");
  const user = [
    "Objects:",
    objects,
    "",
    `Task: ${scene.task.fr}`,
    "",
    "History:",
    lines || "(none)",
    "",
    `Learner's latest line: ${userText}`,
  ].join("\n");

  return { system, user };
}
