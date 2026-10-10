// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
const css = read("./tokens.css");
const motion = read("./motion.css");
const index = read("../index.css");

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
    expect(block).toContain("#1C1E22");
    expect(block).toContain("rgba(22, 24, 28, 0.78)");
    expect(block).toContain("#FFFFFF");
  });

  it("keeps the existing variable names", () => {
    for (const v of ["--paper", "--glass", "--glass-border", "--text-h1", "--text-small", "--radius-sheet", "--space-6"]) {
      expect(css).toContain(`${v}:`);
    }
  });
});

describe("tokens.css v3", () => {
  it("carries the v3 palette", () => {
    for (const [v, val] of [
      ["--paper", "#F4F2EE"],
      ["--ink", "#121316"],
      ["--ink2", "#5E616A"],
      ["--night", "#0A0B0D"],
      ["--moss", "#127A5E"],
      ["--moss-soft", "#DCEFE6"],
      ["--sun", "#E7A92E"],
      ["--clay", "#B4472A"],
      ["--clay-soft", "#F7E3DB"],
      ["--card", "#FFFFFF"],
      ["--line", "rgba(18, 19, 22, 0.08)"],
    ]) {
      expect(css).toContain(`${v}: ${val};`);
    }
  });

  it("uses Instrument Serif, Geist and Geist Mono", () => {
    expect(css).toMatch(/--font-display: "Instrument Serif"/);
    expect(css).toMatch(/--font-body: "Geist"/);
    expect(css).toMatch(/--font-mono: "Geist Mono"/);
  });

  it("has the v3 radii", () => {
    for (const r of ["--radius-chip: 10px;", "--radius-thumb: 14px;", "--radius-inner: 16px;", "--radius-card: 24px;", "--radius-sheet: 32px;", "--radius-pill: 999px;"]) {
      expect(css).toContain(r);
    }
  });

  it("has the motion tokens", () => {
    for (const t of [
      "--dur-1: 120ms;",
      "--dur-2: 220ms;",
      "--dur-3: 360ms;",
      "--dur-4: 600ms;",
      "--dur-loop: 4800ms;",
      "--ease-out: cubic-bezier(0.22, 1, 0.36, 1);",
      "--ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);",
      "--ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1);",
      "--ease-loop: cubic-bezier(0.65, 0, 0.35, 1);",
    ]) {
      expect(css).toContain(t);
    }
  });
});

describe("motion.css", () => {
  it("is imported from index.css", () => {
    expect(index).toContain('@import "./styles/motion.css";');
  });

  it("has the v3 keyframes and motion classes", () => {
    for (const k of ["riseIn", "popIn", "sheetUp", "fadeIn", "orbBreathe", "orbSpin", "orbListen", "ripple", "glowPulse", "dot", "shimmer", "bump"]) {
      expect(motion).toContain(`@keyframes ${k}{`);
    }
    for (const c of [".screen-enter", ".sheet-up", ".pop-in", ".press:active", ".orb-breathe"]) expect(motion).toContain(c);
  });

  it("stops loops and transforms when motion is reduced and keeps fades", () => {
    const i = motion.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(i).toBeGreaterThan(-1);
    const block = motion.slice(i);
    expect(block).toContain("animation-iteration-count: 1 !important");
    expect(block).toContain("transform: none !important");
    expect(block).toContain("fadeIn 200ms");
  });
});
