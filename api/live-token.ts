import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, originAllowed } from "./_lib/cors.js";
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

export function createHandler({
  createClient,
  now = () => Date.now(),
}: {
  createClient: (apiKey: string) => TokenClient;
  now?: () => number;
}) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (applyCors(req, res)) return;
    res.setHeader("Cache-Control", "no-store");
    if (req.method && req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    if (!originAllowed(req)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      res.status(500).json({ error: "missing_key" });
      return;
    }
    const model = process.env.GEMINI_MODEL_LIVE || DEFAULT_LIVE_MODEL;
    const t = now();
    const expireTime = new Date(t + 30 * 60_000).toISOString();
    try {
      const token = await createClient(key).authTokens.create({
        config: {
          uses: 1,
          expireTime,
          newSessionExpireTime: new Date(t + 60_000).toISOString(),
          liveConnectConstraints: { model },
        },
      });
      if (typeof token.name !== "string" || !token.name || token.name.includes(key)) {
        res.status(502).json({ error: "token_failed" });
        return;
      }
      res.status(200).json({ token: token.name, expires_at: expireTime, model });
    } catch {
      res.status(502).json({ error: "token_failed" });
    }
  };
}

export default createHandler({ createClient: (apiKey) => new GoogleGenAI({ apiKey }) });
