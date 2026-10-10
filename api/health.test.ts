// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "./health";

describe("api/health", () => {
  it("responds 200 {ok:true}", () => {
    let code = 0;
    let body: unknown;
    const res = {
      status(c: number) {
        code = c;
        return res;
      },
      json(b: unknown) {
        body = b;
        return res;
      },
    };
    handler({} as VercelRequest, res as unknown as VercelResponse);
    expect(code).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});
