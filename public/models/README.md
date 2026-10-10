# public/models

The native iOS app ships the on-device model from here. Vite copies this folder into `dist/`, Capacitor serves it at `https://localhost/models/`, and `src/offline/gemma.ts` loads it from that URL with no download and no OPFS copy.

- File: `gemma3-1b-it-int4-web.task` (exact name, about 700 MB).
- Fetch it: `pnpm model:fetch` (runs `scripts/fetch-model.sh`; uses the `hf` CLI if installed, else curl with `HF_TOKEN`).
- Not in git (`.gitignore`), not deployed to Vercel (`.vercelignore`), never precached by the service worker. The web app keeps the file picker in Settings.

Licence: Gemma is distributed under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms). The app must show that notice and link the [prohibited use policy](https://ai.google.dev/gemma/prohibited_use_policy); Settings does so in the offline tutor section.
