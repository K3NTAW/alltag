import type { CapacitorConfig } from "@capacitor/cli";

// With iosScheme https the app origin is https://localhost; add it to ALLOWED_ORIGINS on Vercel.
const config: CapacitorConfig = {
  appId: "ch.alltag.app",
  appName: "alltag",
  webDir: "dist",
  server: { iosScheme: "https" },
  ios: { contentInset: "automatic", allowsLinkPreview: false },
};

export default config;
