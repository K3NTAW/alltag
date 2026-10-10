import type { VercelRequest, VercelResponse } from "@vercel/node";

// Origins outside the Vercel host that may call /api, e.g. the native app at https://localhost.
// Exact matches only; there is never a wildcard.
export function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o && o !== "*");
}

function header(req: VercelRequest, name: string): string | undefined {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

function listed(origin: string | undefined): origin is string {
  return !!origin && allowedOrigins().includes(origin);
}

// Sets CORS headers for an allowlisted Origin. Returns true when it answered a preflight
// and the caller must return.
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = header(req, "origin");
  if (listed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

// Browser guard: same origin, or an Origin in ALLOWED_ORIGINS. Header-less callers (curl,
// scripts) pass. Not a substitute for auth or rate limiting.
export function originAllowed(req: VercelRequest): boolean {
  const origin = header(req, "origin");
  if (listed(origin)) return true;
  const site = header(req, "sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  if (!origin) return true;
  const host = header(req, "x-forwarded-host") ?? header(req, "host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
