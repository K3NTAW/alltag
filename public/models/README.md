# public/models

The native iOS app ships the on-device model from here. Vite copies this folder into `dist/`, Capacitor serves it at `https://localhost/models/`, and `src/offline/gemma.ts` loads it from that URL with no download and no OPFS copy.

- File: `gemma-4-E2B-it-web.task` (exact name, about 2 GB), Gemma 4 E2B instruct from [litert-community/gemma-4-E2B-it-litert-lm](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm). Use the `.task` file; the `.litertlm` file next to it is for the LiteRT-LM runtime, not MediaPipe.
- Fetch it: `pnpm model:fetch` (runs `scripts/fetch-model.sh`; uses the `hf` CLI if installed, else curl). The repo is not gated, so no token is needed; `HF_TOKEN` is used if set.
- Not in git (`.gitignore`), not deployed to Vercel (`.vercelignore`), never precached by the service worker. The web app keeps the file picker in Settings.

Licence: Gemma 4 is released under [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0). Settings shows "on-device model: Gemma 4 E2B, Apache 2.0" in the offline tutor section.
