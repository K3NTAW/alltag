import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Registered by hand: virtual:pwa-register needs workbox-window, a second dependency.
// autoUpdate makes the worker skipWaiting and claim clients, so a new build takes over on its own.
// Dev serves no sw.js, so production only.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
