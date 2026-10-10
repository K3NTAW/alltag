import type { CorrectRequest, CorrectResponse, TurnRequest, TurnResponse } from "../lib/types";
import { gemma } from "./gemma";
import { correctPrompt, parseCorrect, parseTurn, turnPrompt } from "./prompts";

export class GemmaUnavailable extends Error {
  constructor(reason?: string) {
    super(reason ? `offline tutor unavailable: ${reason}` : "offline tutor unavailable");
    this.name = "GemmaUnavailable";
  }
}

async function ready(): Promise<void> {
  if (gemma.status().state === "ready") return;
  try {
    await gemma.ensureLoaded();
  } catch (e) {
    throw new GemmaUnavailable(e instanceof Error ? e.message : undefined);
  }
  if (gemma.status().state !== "ready") throw new GemmaUnavailable(gemma.status().reason);
}

export async function localTurn(req: TurnRequest): Promise<TurnResponse> {
  await ready();
  return parseTurn(await gemma.generate(turnPrompt(req), { maxTokens: 160 }));
}

export async function localCorrect(req: CorrectRequest): Promise<CorrectResponse> {
  await ready();
  return parseCorrect(await gemma.generate(correctPrompt(req), { maxTokens: 256 }));
}
