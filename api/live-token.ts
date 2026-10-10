import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export const DEFAULT_LIVE_MODEL = "gemini-3.8-live";

interface TokenClient {
  authTokens: {
    create(params: {
      config: {
        uses: number;
        expireTime: string;
        newSessionExpireTime: string;
        liveConnectConstraints: { model: string };
      };
    }): Promise<{ name?: string }>;
  };
}

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

export function createHandler({
  createClient,
  now = () => Date.now(),
}: {
  createClient: (apiKey: string) => TokenClient;
  now?: () => number;
}) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method && req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    if (!sameOrigin(req)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      res.status(500).json({ error: "missing_key" });
      return;
    }
    const t = now();
    const expireTime = new Date(t + 30 * 60_000).toISOString();
    try {
      const token = await createClient(key).authTokens.create({
        config: {
          uses: 1,
          expireTime,
          newSessionExpireTime: new Date(t + 60_000).toISOString(),
          liveConnectConstraints: { model: process.env.GEMINI_MODEL_LIVE ?? DEFAULT_LIVE_MODEL },
        },
      });
      if (typeof token.name !== "string" || !token.name || token.name.includes(key)) {
        res.status(502).json({ error: "token_failed" });
        return;
      }
      res.status(200).json({ token: token.name, expires_at: expireTime });
    } catch {
      res.status(502).json({ error: "token_failed" });
    }
  };
}

export default createHandler({ createClient: (apiKey) => new GoogleGenAI({ apiKey }) });
