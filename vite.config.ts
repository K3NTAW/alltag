import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// vitest 5 removed environmentMatchGlobs; projects give the same split:
// src runs in jsdom, api and docs run in node.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // public/manifest.webmanifest stays the single manifest; the plugin only adds the service worker.
    // The app shell is precached; /api is never cached.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: false,
      includeAssets: ["manifest.webmanifest", "icon-192.svg", "icon-512.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // Workbox tests a RegExp against the full href, so match /api on the pathname instead.
        runtimeCaching: [{ urlPattern: ({ url }) => url.pathname.startsWith("/api/"), handler: "NetworkOnly" }],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
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
