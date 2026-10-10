// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

describe("tokens.css glass layer", () => {
  it("defines the glass variables", () => {
    for (const v of [
      "--glass-light-bg",
      "--glass-light-border",
      "--glass-light-shadow",
      "--glass-dark-bg",
      "--glass-dark-border",
      "--glass-dark-shadow",
      "--glass-clear-bg",
      "--glass-clear-border",
      "--glass-clear-shadow",
      "--glass-tint-moss",
      "--radius-capsule",
    ]) {
      expect(css).toContain(`${v}:`);
    }
    expect(css).toContain("--glass-blur: 24px;");
    expect(css).toContain("--tabbar-h: 64px;");
    expect(css).toContain("--tabbar-gap: 16px;");
  });

  it("has the three glass classes with blur on both prefixes", () => {
    for (const c of [".glass-light", ".glass-dark", ".glass-clear"]) expect(css).toMatch(new RegExp(`\\${c}\\s*\\{`));
    expect(css).toContain("-webkit-backdrop-filter");
    expect(css).toContain(".glass-specular::before");
    expect(css).toContain(".tint-moss");
    expect(css).toContain(".bg-paper");
    expect(css).toContain(".bg-night");
  });

  it("falls back when transparency is reduced", () => {
    const i = css.indexOf("@media (prefers-reduced-transparency: reduce)");
    expect(i).toBeGreaterThan(-1);
    const block = css.slice(i);
    expect(block).toContain("#1A1D22");
    expect(block).toContain("rgba(20, 22, 26, 0.72)");
    expect(block).toContain("var(--card)");
  });

  it("keeps the existing variable names", () => {
    for (const v of ["--paper", "--glass", "--glass-border", "--text-h1", "--text-small", "--radius-sheet", "--space-6"]) {
      expect(css).toContain(`${v}:`);
    }
  });
});
