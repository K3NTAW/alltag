// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// package.json has "type": "module", so Vercel runs api/*.js as native Node
// ESM. Relative runtime imports need an explicit ".js" extension there.

const API_DIR = fileURLToPath(new URL(".", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!name.endsWith(".ts") || name.endsWith(".test.ts")) return [];
    return [path];
  });
}

// Matches `import ... from "x"` and `export ... from "x"`, across lines.
const FROM_RE = /\b(import|export)\s+([^;'"]*?)\s*from\s*["']([^"']+)["']/g;
// Matches side-effect imports: `import "x"`.
const BARE_RE = /\bimport\s+["']([^"']+)["']/g;

function badSpecifiers(source: string): string[] {
  const bad: string[] = [];
  for (const m of source.matchAll(FROM_RE)) {
    const clause = m[2];
    const spec = m[3];
    if (/^type\b/.test(clause)) continue;
    if (spec.startsWith(".") && !spec.endsWith(".js")) bad.push(spec);
  }
  for (const m of source.matchAll(BARE_RE)) {
    const spec = m[1];
    if (spec.startsWith(".") && !spec.endsWith(".js")) bad.push(spec);
  }
  return bad;
}

describe("api ESM imports", () => {
  it("flags bare relative runtime specifiers, single and multi-line", () => {
    expect(badSpecifiers('import { a } from "./_lib/cors";')).toEqual([
      "./_lib/cors",
    ]);
    expect(
      badSpecifiers('import {\n  a,\n  b,\n} from "./_prompts/scene";'),
    ).toEqual(["./_prompts/scene"]);
    expect(badSpecifiers('export { a } from "./x";')).toEqual(["./x"]);
    expect(badSpecifiers('import "./side";')).toEqual(["./side"]);
    expect(badSpecifiers('import { a } from "./_lib/cors.js";')).toEqual([]);
    expect(badSpecifiers('import type { T } from "../src/lib/types";')).toEqual(
      [],
    );
    expect(badSpecifiers('import { x } from "@google/genai";')).toEqual([]);
  });

  it("every runtime relative import under api/ ends in .js", () => {
    const files = sourceFiles(API_DIR);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap((file) =>
      badSpecifiers(readFileSync(file, "utf8")).map(
        (spec) => `${relative(API_DIR, file)}: ${spec}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
