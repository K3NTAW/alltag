# Architecture

A Vite + React client and a handful of thin Vercel functions under `api/`. The functions only hold keys and shape model output; all learner state lives in the browser.

## Screens and singletons

There is no router and no state library.

- `src/lib/screen.ts`: a module-level `current` screen (`look | scene | roleplay | corrections | review | diary | settings`), changed with `go(screen)` and read in React via `useScreen()` (`useSyncExternalStore`).
- `src/lib/session.ts`: a module-level `session` object for the current loop, cleared with `resetSession()`:
  - `scene`: the `SceneResult` from `/api/scene`
  - `frame`: JPEG data URL of the frozen camera frame
  - `recallCardId`: id of a due card the roleplay should open with (set in `src/screens/Scene.tsx` via `findRecall`, consumed and cleared in `src/screens/Roleplay.tsx`)
  - `lastExchange`: `{ transcript, corrections, kept_phrase_fr[] }`, handed from Roleplay to Corrections

Flow: Look (camera, `/api/scene`) -> Scene (labels, object sheet, keep) -> Roleplay -> Corrections -> back to Look. Review, Diary and Settings hang off the main screens.

## Dialogue state machine

The loop is `idle -> listening -> thinking -> speaking -> correcting`.

```
          start / hold mic
  idle ---------------------> listening
   ^                             |  STT turn end (VAD 3 s horizon > 0.5) or send_flush
   |                             v
   |                          thinking      (Live: model turn; fallback: POST /api/turn)
   |                             |
   |                             v
   |   barge-in (tts.stop) <- speaking      (Live audio or Gradium TTS)
   |        |                    |
   |        +---> listening      |  task_done or 4 learner turns
   |                             v
   +------------------------ correcting     (POST /api/correct per learner line,
          go("corrections")                  then Corrections screen)
```

Where each state lives in code:

- `src/voice/useVoice.ts` (`VoiceState = idle | listening | thinking | speaking`): Gradium STT + TTS, used by the Review screen. `thinking` is set between a final transcript and the answer; `speak()` sets `speaking`; `stop()` cuts TTS for barge-in.
- `src/voice/useLive.ts` (`LiveState = idle | connecting | listening | speaking | done | error`): Gemini Live for Noé. Live has no separate thinking phase; the server streams audio as soon as it has it. `done` fires when the model calls the `task_done` tool. `error` switches the Roleplay screen to the text fallback that calls `/api/turn`.
- `correcting` is the `finish()` step in `src/screens/Roleplay.tsx`: it stops the live session, posts every learner line to `/api/correct` in parallel, dedupes the corrections, writes `session.lastExchange` and calls `go("corrections")`.

## Data in localStorage

| Key | Module | Content |
|---|---|---|
| `alltag.settings` | `src/lib/settings.ts` | `{ language: "fr", level, voiceId, speed }` |
| `alltag.cards` | `src/srs/store.ts` | `Card[]`: phrase, noun, photo crop (JPEG data URL), place, errorType, SM-2 `ease`, `interval` (days), `reps`, `due`, `learnedAt` (epoch ms) |

`src/srs/store.ts` falls back to an in-memory store if localStorage is missing or throws. Nothing is sent to a server except the frame, the transcript lines and the known-words list needed for each call.

## WebSocket message flow (Gradium)

The browser first gets a token from `GET /api/gradium-token` (server exchanges `GRADIUM_API_KEY` via `x-api-key` at `https://api.gradium.ai/api/api-keys/token`). Shapes below are exactly what `src/voice/stt.ts` and `src/voice/tts.ts` send and read.

### STT: `wss://api.gradium.ai/api/speech/asr?token=<token>`

```
browser -> { "type": "setup", "model_name": "default", "input_format": "pcm",
             "json_config": { "language": "fr", "delay_in_frames": 10 } }
browser -> { "type": "audio", "audio": "<base64 PCM16, 24 kHz mono, 1920 samples>" }   (repeated, 80 ms each)
server  -> { "type": "text", "text": "je voudrais" }                                  (partial words, appended)
server  -> { "type": "step", "vad": [ { "horizon_s": 3, "inactivity_prob": 0.62 }, ... ] }
browser -> { "type": "send_flush", "flush_id": 1 }                                    (manual turn end)
server  -> { "type": "flushed" }
browser -> { "type": "end_of_stream" }                                                (on close)
```

Turn end: a `step` whose 3 s horizon has `inactivity_prob > 0.5`, or a `flushed` reply. Messages sent before the socket opens are queued. Mic audio comes from an AudioWorklet (`src/voice/pcm-worklet.ts`) and is resampled to 24 kHz in `stt.ts`.

### TTS: `wss://api.gradium.ai/api/speech/tts?token=<token>`

```
browser -> { "type": "setup", "voice_id": "<settings.voiceId>", "model_name": "default", "output_format": "pcm" }
browser -> { "type": "text", "text": "un café, s'il vous plaît" }
browser -> { "type": "end_of_stream" }
server  -> { "type": "audio", "audio": "<base64 PCM>" }      (repeated, scheduled back to back on an AudioContext)
server  -> { "type": "end_of_stream" }                        (socket closes, promise resolves when playback drains)
```

`stop()` closes the socket and stops all scheduled sources (barge-in).

## Gemini Live

`POST /api/live-token` mints a single-use ephemeral token (`authTokens.create`, `uses: 1`, 30 min expiry, 60 s to open a session, constrained to `GEMINI_MODEL_LIVE`). `src/voice/live.ts` passes that token as the `apiKey` of a `GoogleGenAI` client (`apiVersion: "v1beta"`) and calls `ai.live.connect` with audio responses, input and output transcription, the Noé system prompt and a `task_done` function tool.
