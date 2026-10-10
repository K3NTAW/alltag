import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// vitest 5 removed environmentMatchGlobs; projects give the same split:
// src runs in jsdom, api and docs run in node.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["api/**/*.test.ts", "docs/**/*.test.ts"],
        },
      },
    ],
  },
});
