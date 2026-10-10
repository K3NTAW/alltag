// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowedOrigins, applyCors, originAllowed } from "./cors";

const APP = "https://localhost";

function mockRes() {
  const out: { code: number; ended: boolean; headers: Record<string, string> } = {
    code: 0,
    ended: false,
    headers: {},
  };
  const res = {
    status(c: number) {
      out.code = c;
      return res;
    },
    end() {
      out.ended = true;
      return res;
    },
    setHeader(k: string, v: string) {
      out.headers[k.toLowerCase()] = v;
      return res;
    },
  };
  return { res: res as unknown as VercelResponse, out };
}

function req(method: string, headers: Record<string, string> = {}) {
  return { method, headers } as unknown as VercelRequest;
}

describe("api/_lib/cors", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("parses ALLOWED_ORIGINS, trimmed, and drops wildcards", () => {
    vi.stubEnv("ALLOWED_ORIGINS", ` ${APP} , capacitor://localhost,,*`);
    expect(allowedOrigins()).toEqual([APP, "capacitor://localhost"]);
    vi.stubEnv("ALLOWED_ORIGINS", "");
    expect(allowedOrigins()).toEqual([]);
  });

  it("answers a preflight from an allowed origin with 204 and the exact origin", () => {
    vi.stubEnv("ALLOWED_ORIGINS", `${APP},https://other.example`);
    const { res, out } = mockRes();
    expect(applyCors(req("OPTIONS", { origin: APP }), res)).toBe(true);
    expect(out.code).toBe(204);
    expect(out.ended).toBe(true);
    expect(out.headers).toEqual({
      "access-control-allow-origin": APP,
      vary: "Origin",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "access-control-max-age": "86400",
    });
  });

  it("ends a preflight from an unknown origin without CORS headers", () => {
    vi.stubEnv("ALLOWED_ORIGINS", APP);
    const { res, out } = mockRes();
    expect(applyCors(req("OPTIONS", { origin: "https://evil.example" }), res)).toBe(true);
    expect(out.code).toBe(204);
    expect(out.ended).toBe(true);
    expect(out.headers).toEqual({});
  });

  it("sets headers on a POST from an allowed origin and lets the route continue", () => {
    vi.stubEnv("ALLOWED_ORIGINS", APP);
    const { res, out } = mockRes();
    expect(applyCors(req("POST", { origin: APP }), res)).toBe(false);
    expect(out.code).toBe(0);
    expect(out.headers["access-control-allow-origin"]).toBe(APP);
  });

  it("never sets headers when ALLOWED_ORIGINS is empty", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "");
    for (const origin of [APP, "*", "null"]) {
      const { res, out } = mockRes();
      expect(applyCors(req("POST", { origin }), res)).toBe(false);
      expect(out.headers).toEqual({});
    }
  });

  it("never echoes a wildcard, even if configured", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "*");
    const { res, out } = mockRes();
    applyCors(req("POST", { origin: "*" }), res);
    applyCors(req("POST", { origin: APP }), res);
    expect(out.headers).toEqual({});
    expect(readFileSync(join(__dirname, "cors.ts"), "utf8")).not.toMatch(/Allow-Origin", "\*"/);
  });

  it("originAllowed: same origin, header-less, or allowlisted", () => {
    vi.stubEnv("ALLOWED_ORIGINS", APP);
    expect(originAllowed(req("POST"))).toBe(true);
    expect(originAllowed(req("POST", { origin: "https://a.example", host: "a.example" }))).toBe(true);
    expect(originAllowed(req("POST", { origin: APP, "sec-fetch-site": "cross-site", host: "a.example" }))).toBe(true);
    expect(originAllowed(req("POST", { origin: "https://evil.example", "sec-fetch-site": "cross-site", host: "a.example" }))).toBe(false);
    expect(originAllowed(req("POST", { origin: "https://evil.example", host: "a.example" }))).toBe(false);
  });
});
