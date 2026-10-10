import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { GradiumToken } from "../src/lib/types";

const TOKEN_URL = "https://api.gradium.ai/api/api-keys/token";

function header(req: VercelRequest, name: string): string | undefined {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

// Browser guard: reject cross-site callers. Not a substitute for auth or rate limiting.
function sameOrigin(req: VercelRequest): boolean {
  const site = header(req, "sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = header(req, "origin");
  if (!origin) return true;
  const host = header(req, "x-forwarded-host") ?? header(req, "host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function createHandler({ fetchImpl }: { fetchImpl: typeof fetch }) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method && req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    if (!sameOrigin(req)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const key = process.env.GRADIUM_API_KEY;
    if (!key) {
      res.status(500).json({ error: "missing_key" });
      return;
    }
    try {
      const upstream = await fetchImpl(TOKEN_URL, {
        method: "GET",
        headers: { "x-api-key": key },
      });
      if (!upstream.ok) {
        res.status(502).json({ error: "token_failed" });
        return;
      }
      const data = (await upstream.json()) as Partial<GradiumToken>;
      if (typeof data.token !== "string" || typeof data.expires_at !== "string") {
        res.status(502).json({ error: "token_failed" });
        return;
      }
      const body: GradiumToken = { token: data.token, expires_at: data.expires_at };
      res.status(200).json(body);
    } catch {
      res.status(502).json({ error: "token_failed" });
    }
  };
}

export default createHandler({ fetchImpl: (input, init) => fetch(input, init) });
