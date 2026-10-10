import type { ExtractRequest, ExtractResponse, TranslateRequest, TranslateResponse } from "./types";

// Kept apart from api.ts on purpose; same shape as its post helper.
async function post<T>(name: string, body: unknown): Promise<T> {
  const base = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
  const res = await fetch(`${base}/api/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} ${res.status}`);
  return (await res.json()) as T;
}

export function postTranslate(req: TranslateRequest): Promise<TranslateResponse> {
  return post("translate", req);
}

export function postExtract(req: ExtractRequest): Promise<ExtractResponse> {
  return post("extract", req);
}
