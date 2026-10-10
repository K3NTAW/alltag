// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Cheap guard on the service worker config; the real check is `pnpm build` emitting dist/sw.js.
const config = readFileSync(resolve(__dirname, "../../vite.config.ts"), "utf8");

describe("vite.config.ts PWA", () => {
  it("registers VitePWA", () => {
    expect(config).toContain('from "vite-plugin-pwa"');
    expect(config).toMatch(/VitePWA\(\{/);
  });

  it("keeps /api out of the navigate fallback", () => {
    expect(config).toMatch(/navigateFallbackDenylist:\s*\[\/\^\\\/api\\\/\/\]/);
  });

  it("sends /api NetworkOnly", () => {
    expect(config).toMatch(/runtimeCaching:.*"\/api\/".*handler:\s*"NetworkOnly"/);
  });

  it("uses the existing manifest", () => {
    expect(config).toContain("manifest: false");
  });
});
