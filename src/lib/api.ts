import type {
  CorrectRequest,
  CorrectResponse,
  GradiumToken,
  Level,
  SceneRequest,
  SceneResult,
  TurnRequest,
  TurnResponse,
} from "./types";
import { localCorrect, localTurn } from "../offline/local-api";

async function call<T>(name: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${name}`, init);
  if (!res.ok) throw new Error(`${name} ${res.status}`);
  return (await res.json()) as T;
}

function post<T>(name: string, body: unknown): Promise<T> {
  return call<T>(name, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function postScene(req: SceneRequest): Promise<SceneResult> {
  return post("scene", req);
}

function offline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// Offline or a network error (fetch rejects with TypeError) -> on-device Gemma.
// HTTP errors keep throwing: the server answered, so the network is fine.
async function withLocal<T extends object>(cloud: () => Promise<T>, local: () => Promise<T>): Promise<T> {
  if (offline()) return { ...(await local()), source: "local" };
  try {
    return await cloud();
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    return { ...(await local()), source: "local" };
  }
}

export function postTurn(req: TurnRequest): Promise<TurnResponse> {
  return withLocal(() => post<TurnResponse>("turn", req), () => localTurn(req));
}

export function postCorrect(req: CorrectRequest): Promise<CorrectResponse> {
  return withLocal(() => post<CorrectResponse>("correct", req), () => localCorrect(req));
}

export function getGradiumToken(): Promise<GradiumToken> {
  return call("gradium-token");
}

export interface CheckRequest {
  target_fr: string;
  transcript: string;
  level: Level;
}

export interface CheckResponse {
  grade: 0 | 1 | 2 | 3 | 4 | 5;
  correct: boolean;
  note_en: string;
}

export function postCheck(req: CheckRequest): Promise<CheckResponse> {
  return post("check", req);
}

export function getLiveToken(): Promise<{ token: string; expires_at: string; model?: string }> {
  return call("live-token", { method: "POST" });
}
