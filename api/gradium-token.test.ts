// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHandler } from "./gradium-token";

const KEY = "gk_secret_value_123";

function mockRes() {
  const out: { code: number; body: unknown; headers: Record<string, string> } = {
    code: 0,
    body: undefined,
    headers: {},
  };
  const res = {
    status(c: number) {
      out.code = c;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
    setHeader(k: string, v: string) {
      out.headers[k.toLowerCase()] = v;
      return res;
    },
  };
  return { res: res as unknown as VercelResponse, out };
}

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("api/gradium-token", () => {
  const prev = process.env.GRADIUM_API_KEY;
  afterEach(() => {
    if (prev === undefined) delete process.env.GRADIUM_API_KEY;
    else process.env.GRADIUM_API_KEY = prev;
  });

  it("returns token and expires_at without leaking the key", async () => {
    process.env.GRADIUM_API_KEY = KEY;
    const fetchImpl = fakeFetch(200, { token: "t1", expires_at: "2026-10-10T20:00:00Z" });
    const { res, out } = mockRes();
    await createHandler({ fetchImpl })({ method: "GET" } as VercelRequest, res);
    expect(out.code).toBe(200);
    expect(out.body).toEqual({ token: "t1", expires_at: "2026-10-10T20:00:00Z" });
    expect(JSON.stringify(out.body)).not.toContain(KEY);
    expect(out.headers["cache-control"]).toBe("no-store");
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.gradium.ai/api/api-keys/token");
    expect((init as RequestInit).headers).toEqual({ "x-api-key": KEY });
  });

  it("returns 500 without GRADIUM_API_KEY", async () => {
    delete process.env.GRADIUM_API_KEY;
    const fetchImpl = fakeFetch(200, { token: "t1", expires_at: "x" });
    const { res, out } = mockRes();
    await createHandler({ fetchImpl })({ method: "POST" } as VercelRequest, res);
    expect(out.code).toBe(500);
    expect(out.body).toEqual({ error: "missing_key" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 502 when upstream fails", async () => {
    process.env.GRADIUM_API_KEY = KEY;
    const fetchImpl = fakeFetch(401, { error: "unauthorized" });
    const { res, out } = mockRes();
    await createHandler({ fetchImpl })({ method: "GET" } as VercelRequest, res);
    expect(out.code).toBe(502);
    expect(out.body).toEqual({ error: "token_failed" });
    expect(JSON.stringify(out.body)).not.toContain(KEY);
  });
});
