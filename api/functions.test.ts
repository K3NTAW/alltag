// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

describe("vercel functions", () => {
  it("builds only top-level api routes", () => {
    const config = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
    expect(Object.keys(config.functions)).toEqual(["api/*.ts"]);
  });

  it("stays within the Hobby limit of 12 functions", () => {
    const routes = readdirSync(join(root, "api")).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    );
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.length).toBeLessThanOrEqual(12);
  });

  it("every route calls applyCors first", () => {
    const routes = readdirSync(join(root, "api")).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    );
    for (const r of routes) {
      const src = readFileSync(join(root, "api", r), "utf8");
      expect(src, r).toContain("if (applyCors(req, res)) return;");
    }
  });
});
