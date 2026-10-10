// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const readme = readFileSync(join(root, "README.md"), "utf8");

function routes(): string[] {
  return readdirSync(join(root, "api"), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts"))
    .map((e) => e.name.replace(/\.ts$/, ""));
}

function envVars(): string[] {
  return readFileSync(join(root, ".env.example"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=")[0].trim())
    .filter(Boolean);
}

describe("README", () => {
  it("names every api route", () => {
    const names = routes();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(readme).toContain(`/api/${name}`);
  });

  it("names every env var from .env.example", () => {
    const vars = envVars();
    expect(vars).toContain("GEMINI_API_KEY");
    for (const v of vars) expect(readme).toContain(v);
  });

  it("names every GEMINI_MODEL_* var", () => {
    const models = envVars().filter((v) => v.startsWith("GEMINI_MODEL_"));
    expect(models.length).toBeGreaterThan(0);
    for (const v of models) expect(readme).toContain(v);
  });

  it("names the partners", () => {
    for (const word of ["Entire", "Gradium", "Gemini"]) expect(readme).toContain(word);
  });
});

describe("manifest", () => {
  it("parses as JSON with name alltag", () => {
    const manifest = JSON.parse(readFileSync(join(root, "public/manifest.webmanifest"), "utf8")) as {
      name: string;
    };
    expect(manifest.name).toBe("alltag");
  });
});
