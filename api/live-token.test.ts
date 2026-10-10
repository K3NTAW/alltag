// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHandler } from "./live-token";

const KEY = "AIza_secret_value_123";
const NOW = Date.parse("2026-10-10T12:00:00.000Z");

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

function fakeClient(impl: () => Promise<{ name?: string }>) {
  const create = vi.fn(impl);
  const createClient = vi.fn(() => ({ authTokens: { create } }));
  return { create, createClient };
}

describe("api/live-token", () => {
  const prevKey = process.env.GEMINI_API_KEY;
  const prevModel = process.env.GEMINI_MODEL_LIVE;
  afterEach(() => {
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
    if (prevModel === undefined) delete process.env.GEMINI_MODEL_LIVE;
    else process.env.GEMINI_MODEL_LIVE = prevModel;
  });

  it("returns token and expires_at without leaking the key, default model", async () => {
    process.env.GEMINI_API_KEY = KEY;
    delete process.env.GEMINI_MODEL_LIVE;
    const { create, createClient } = fakeClient(async () => ({ name: "auth_tokens/abc" }));
    const { res, out } = mockRes();
    await createHandler({ createClient, now: () => NOW })({ method: "POST" } as VercelRequest, res);
    expect(out.code).toBe(200);
    expect(out.body).toEqual({
      token: "auth_tokens/abc",
      expires_at: "2026-10-10T12:30:00.000Z",
      model: "gemini-3.8-live",
    });
    expect(JSON.stringify(out.body)).not.toContain(KEY);
    expect(out.headers["cache-control"]).toBe("no-store");
    expect(createClient).toHaveBeenCalledWith(KEY);
    expect(create).toHaveBeenCalledWith({
      config: {
        uses: 1,
        expireTime: "2026-10-10T12:30:00.000Z",
        newSessionExpireTime: "2026-10-10T12:01:00.000Z",
        liveConnectConstraints: { model: "gemini-3.8-live" },
      },
    });
  });

  it("constrains the model to GEMINI_MODEL_LIVE", async () => {
    process.env.GEMINI_API_KEY = KEY;
    process.env.GEMINI_MODEL_LIVE = "gemini-live-custom";
    const { create, createClient } = fakeClient(async () => ({ name: "auth_tokens/x" }));
    const { res, out } = mockRes();
    await createHandler({ createClient })({ method: "POST" } as VercelRequest, res);
    expect(out.code).toBe(200);
    const params = create.mock.calls[0] as unknown as [{ config: { liveConnectConstraints: { model: string } } }];
    expect(params[0].config.liveConnectConstraints.model).toBe("gemini-live-custom");
    expect((out.body as { model: string }).model).toBe("gemini-live-custom");
  });

  it("returns 500 without GEMINI_API_KEY", async () => {
    delete process.env.GEMINI_API_KEY;
    const { create, createClient } = fakeClient(async () => ({ name: "t" }));
    const { res, out } = mockRes();
    await createHandler({ createClient })({ method: "POST" } as VercelRequest, res);
    expect(out.code).toBe(500);
    expect(out.body).toEqual({ error: "missing_key" });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 502 on upstream failure without echoing the key", async () => {
    process.env.GEMINI_API_KEY = KEY;
    const { createClient } = fakeClient(async () => {
      throw new Error(`bad key ${KEY}`);
    });
    const { res, out } = mockRes();
    await createHandler({ createClient })({ method: "POST" } as VercelRequest, res);
    expect(out.code).toBe(502);
    expect(out.body).toEqual({ error: "token_failed" });
    expect(JSON.stringify(out.body)).not.toContain(KEY);
  });

  it("returns 502 when upstream returns no token name", async () => {
    process.env.GEMINI_API_KEY = KEY;
    const { createClient } = fakeClient(async () => ({}));
    const { res, out } = mockRes();
    await createHandler({ createClient })({ method: "POST" } as VercelRequest, res);
    expect(out.code).toBe(502);
  });
});
