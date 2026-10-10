# alltag

Learn a language from the room you are in.

## 1. What it is

Point your phone at anything around you and alltag names what it sees in French, at your level, then drops you into a short spoken roleplay with Noé, the tutor, set in that exact scene. After the exchange you get typed corrections, and every phrase you fumbled goes into a review queue that you clear by speaking, not tapping. When the camera sees the same object again, Noé opens with it. There are no lessons, no streaks, no owl. Everything in the app is this loop:

```
        +-----------------------------------------------------------+
        |                                                           |
        v                                                           |
   +---------+     +----------+     +--------+     +-------+     +--------+
   |  LOOK   | --> |  LISTEN  | --> |   DO   | --> |  FIX  | --> |  KEEP  |
   +---------+     +----------+     +--------+     +-------+     +--------+
   camera frame    Noé names 3-6    roleplay in    typed         SM-2 cards,
   -> Gemini       things at your   the scene,     corrections   reviewed by
   -> scene JSON   level, Gradium   by voice       after the     speaking,
                   playback                        turn          recalled by camera
```

## 2. Why

Apps teach a syllabus. The learner then stands in a Migros or a Zurich café and cannot say anything, because none of it was about their life. What the research says works:

| Principle | Source | What alltag does |
|---|---|---|
| Comprehensible input, 90 to 98 % known words | Krashen, Nation | Prompts enforce a 95 % known-words rule and a level ceiling. |
| Meaning-focused output | Nation's four strands | You speak to get a task done, not to fill a blank. |
| Spaced repetition on recall, not recognition | Leitner, SM-2 | Cards are reviewed by saying the phrase out loud. |
| Correction after the turn | Fluency research, Langua, Praktika | Noé stays in character; a separate grader corrects afterwards. |
| Context-bound memory | Encoding specificity | Each card carries the photo crop where you learned it. |

The gap: camera apps (Vocam, WordCam, CapWords, Wocap) stop at the noun. Conversation apps (Speak, Praktika, Langua, Duolingo Max) roleplay a generic café, and none of them keep a spaced-repetition memory of your errors. Nobody combines what the camera sees with a conversation you must get through and a memory of what you got wrong.

## 3. Setup

```sh
pnpm i
cp .env.example .env    # fill in the keys
pnpm dev                # http://localhost:5173 (use `vercel dev` to run api/ locally too)
vercel deploy
```

`.env` (all server-side, the browser never sees a key):

| Var | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini key for api/scene, api/turn, api/correct, api/check, api/live-token |
| `GRADIUM_API_KEY` | Gradium key, only used to mint short-lived browser tokens |
| `GEMINI_MODEL_VISION`, `GEMINI_MODEL_TURN`, `GEMINI_MODEL_GRADER`, `GEMINI_MODEL_LIVE`, `GEMINI_MODEL_CHECK`, `GEMINI_MODEL_LEVEL` | One model per job, see the model table in section 4 |
| `GEMINI_MODEL` | Optional last-resort alias read by the routes when their own var is unset |

On Vercel, add the same vars under Project Settings, Environment Variables (or `vercel env add GEMINI_API_KEY`) for Production and Preview. `vercel.json` sets the Vite framework and a 30 s `maxDuration` for `api/**/*.ts`.

## 4. Architecture

```
 Browser (Vite + React 19 + TS + Tailwind v4, PWA, mobile first)
 +--------------------------------------------------------------------+
 | Camera  getUserMedia -> canvas -> JPEG <= 1024 px ----> /api/scene |
 | Live    @google/genai ai.live.connect (mic + Noé audio) -----------+----> Gemini Live
 | Mic     AudioWorklet -> 24 kHz PCM16 -> Gradium STT WebSocket -----+----> Gradium
 | Speaker Gradium TTS WebSocket -> AudioContext ---------------------+----> Gradium
 | SRS     SM-2 cards in localStorage                                 |
 +--------------------------------------------------------------------+
        | fetch /api/*                              ^ short-lived tokens
        v                                           |
 Vercel serverless (Node, thin, holds the keys)     |
 +--------------------------------------------------------------------+
 | /api/scene         Gemini vision -> scene JSON (responseSchema)    |
 | /api/turn          Gemini text   -> tutor reply (Live fallback)    |
 | /api/correct       Gemini grader -> corrections JSON               |
 | /api/check         Gemini        -> review grade 0..5              |
 | /api/live-token    Gemini ephemeral token for Live ---------------+ |
 | /api/gradium-token Gradium key -> single-use token ---------------+ |
 | /api/health        { ok: true }                                    |
 +--------------------------------------------------------------------+
        |                                   |
        v                                   v
     Gemini API                       Gradium API (token exchange)
```

Partner split: Noé live = Gemini Live, native speaker playback and review = Gradium.

**Two-call tutor design.** Dialogue and corrections are two separate model calls. The roleplay call (Gemini Live, or `/api/turn` as fallback) only stays in character and stays fast. The grader (`/api/correct`) runs after the exchange on each learner line with a stronger model and returns typed corrections. Reasons: a single call that both chats and grades is slower, tends to break character to correct mid-sentence (which fluency research says to avoid), and lets grading leak into the roleplay. Split, the grader can be slow and thorough without hurting turn latency, and it can never change what Noé says.

**Gemini Live ephemeral-token flow.** The Gemini key never reaches the browser:

```
 Browser (useLive)            api/live-token.ts                Gemini
 -----------------            -----------------                ------
 POST /api/live-token  --->   same-origin check
                              ai.authTokens.create({
                                uses: 1, expireTime: +30 min,
                                newSessionExpireTime: +60 s,
                                liveConnectConstraints: { model } })  --->
                         <--- { token, expires_at, model }       <--- token name
 new GoogleGenAI({ apiKey: token, apiVersion: "v1beta" })
 ai.live.connect({ model, AUDIO, task_done tool })  ------------------------------>
 <======================= mic PCM up / Noé audio + transcripts down =============>
```

**Model table** (from `.env.example` and the route sources; each route reads its own var, then `GEMINI_MODEL`, then the default):

| Job | Route or file | Env var | Default model | Why |
|---|---|---|---|---|
| Scene vision + JSON | api/scene.ts | `GEMINI_MODEL_VISION` | gemini-3.8-flash | Camera path, flash keeps it under 3 s |
| Text roleplay fallback | api/turn.ts | `GEMINI_MODEL_TURN` | gemini-3.8-flash | Used when Live fails, latency-bound |
| Grader | api/correct.ts | `GEMINI_MODEL_GRADER` | gemini-3.1-pro-preview | Once per exchange, quality beats speed; falls back to gemini-3.8-flash after 8 s or on error |
| Live roleplay (Noé) | api/live-token.ts, src/voice/live.ts | `GEMINI_MODEL_LIVE` | gemini-3.8-live | Native audio and barge-in, lowest turn latency |
| Review check | api/check.ts | `GEMINI_MODEL_CHECK` | gemini-3.5-flash-lite | Trivial transcript vs target comparison, must feel instant |
| CEFR level estimate | not wired yet (reserved) | `GEMINI_MODEL_LEVEL` | gemini-3.8-flash | JSON classification at moderate volume |
| Offline: Gemma 3 1B on device | src/offline/gemma.ts | none (file in OPFS) | gemma3-1b-it-int4-web.task | Text roleplay and corrections when the network is gone; runs in the browser on WebGPU |

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Offline mode (Gemma 3 1B on device)

The cloud path stays the default. When the browser is offline, or a POST to `/api/turn` or `/api/correct` fails with a network error (fetch rejects, not a 4xx/5xx), the client answers with Gemma 3 1B instruct running in the browser through the MediaPipe LLM Inference API (`@mediapipe/tasks-genai`). Replies from the device carry `source: "local"` and Roleplay shows "offline, noé runs on this device".

What works offline:

| Works | Does not |
|---|---|
| Text roleplay with Noé (typed, no Live voice, no Gradium) | Scene parsing from the camera; Look says "camera needs the network" and offers saved scenes |
| Corrections after the exchange | Gemini Live voice |
| Review and recall, the diary, kept phrases (localStorage) | |

Setup, once per browser:

1. On Hugging Face, open `litert-community/Gemma3-1B-IT`, accept the Gemma licence (the repo is gated) and download `gemma3-1b-it-int4-web.task` (about 700 MB).
2. In alltag, open Settings, section "offline tutor", and choose that file. It is copied into the Origin Private File System and loaded from there; the app never downloads it on its own.
3. Optional: set `VITE_GEMMA_MODEL_URL` to a URL you host the file at; Settings then shows a "download" button instead of the file picker.

Requirements and caveats: needs WebGPU (current Chrome or Edge on desktop or Android) and OPFS; elsewhere Settings says "not supported". The MediaPipe LLM Inference web API is in maintenance mode upstream; fine for a hackathon demo, not a long-term bet. A 1B model is much weaker than the cloud models: prompts are short and French, and its JSON is parsed leniently with safe defaults.

## 5. API

Types are in `src/lib/types.ts` (`CheckRequest`/`CheckResponse` in `src/lib/api.ts`). Full examples and error codes in [docs/API.md](docs/API.md).

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/health` | GET | none | `{ ok: true }` |
| `/api/scene` | POST | `SceneRequest { imageBase64, level, knownWords[] }` | `SceneResult { place, objects[{ id, fr, en, article, gender, plural, level, phrase_fr, phrase_en, bbox? }], task{ fr, en, role } }` |
| `/api/turn` | POST | `TurnRequest { scene, history[{ role, text }], userText, level }` | `TurnResponse { reply_fr, reply_en, task_done }` |
| `/api/correct` | POST | `CorrectRequest { scene, userText, level }` | `CorrectResponse { corrections[{ said, better, type, why_en }], kept_phrase_fr }` plus `model_used` |
| `/api/check` | POST | `CheckRequest { target_fr, transcript, level }` | `CheckResponse { grade: 0..5, correct, note_en }` |
| `/api/gradium-token` | GET or POST | none | `GradiumToken { token, expires_at }` |
| `/api/live-token` | POST | none | `{ token, expires_at, model }` |

Errors are `{ error: "<code>" }` with 400 (bad input), 403 (cross-site, token routes), 405, 500 (`missing_key`) or 502 (upstream or bad model output).

## 6. Partner tech

**Gradium** (speech in and out for review, native speaker playback)
- STT WebSocket `wss://api.gradium.ai/api/speech/asr`: 24 kHz PCM16 in 1920-sample (80 ms) chunks, French, `delay_in_frames` 10. Turn-taking uses Gradium's semantic VAD: a `step` message whose 3 s horizon `inactivity_prob` exceeds 0.5 ends the turn; `send_flush` forces one. `src/voice/stt.ts`, `src/voice/pcm-worklet.ts`.
- TTS WebSocket `wss://api.gradium.ai/api/speech/tts`: streamed PCM scheduled on an AudioContext, `stop()` for barge-in. `src/voice/tts.ts`, wired with STT in `src/voice/useVoice.ts`.
- Token exchange: the server trades `GRADIUM_API_KEY` (header `x-api-key`) for a short-lived token, the browser connects with `?token=`. `api/gradium-token.ts`.

**Google Gemini** (vision, dialogue, grader)
- Vision: one JPEG plus level and known words to structured scene JSON. `api/scene.ts`, `api/_prompts/scene.ts`.
- Dialogue: Gemini Live for Noé (`api/live-token.ts`, `src/voice/live.ts`, `src/voice/useLive.ts`), text fallback `api/turn.ts`, `api/_prompts/turn.ts`.
- Grader: `api/correct.ts`, `api/_prompts/correct.ts`; review check `api/check.ts`, `api/_prompts/check.ts`.

**Entire** (session capture behind commits)
- The `entire` CLI records the agent session (prompts, tool calls, transcript) behind each commit, so the jury can audit how the thing was built.
- Enable: install the Entire CLI, then run `entire enable` in the repo root.
- checkpoints branch: <the human fills this in>

## 7. Latency

Targets from the design; measured on the venue wifi by a human.

| Hop | Target | Measured |
|---|---|---|
| STT end of turn (semantic VAD, `delay_in_frames` 10) | < 400 ms after you stop | |
| Gemini first token | < 600 ms | |
| TTS first audio chunk | < 300 ms | |
| **Perceived turn** | **< 1.5 s** | |

Over 3 s the roleplay dies. Fallbacks: shorter replies, the listening pulse, and the text path via `/api/turn` when Live fails.

## 8. Learning design

- **Level control (95 % rule).** The scene JSON tags each object A1 to B2. The scene prompt and the Live prompt get the learner's known words and a ceiling: 95 % of words must be known or A1, at most 2 new items at a time. Nation's coverage rule, operationalised (`api/_prompts/scene.ts`, `src/voice/live.ts`, `api/_prompts/turn.ts`).
- **Correction taxonomy.** `article, gender, case, tense, word_order, vocab, register` (`CorrectionType` in `src/lib/types.ts`). The review queue groups by type, so the app can say "you keep dropping the article" instead of showing 30 random cards.
- **SM-2 by production.** A card is the photo crop plus the phrase. You say it; `/api/check` compares transcript to target and returns a 0 to 5 grade, with a local Levenshtein fallback (`gradeFromTranscript`). Intervals 1, 6, then times ease. `src/srs/store.ts`.
- **Camera-triggered recall.** When a new scene contains an object with a due card, the roleplay opens with it (`findRecall` in `src/srs/recall.ts`, handed off via `session.recallCardId`).
- **No streaks, no XP.** Progress is the diary: real sentences you can now say, each with the photo where you learned it.

## 9. Entire

Every agent-assisted commit in this repo carries its session. To browse them:

1. Install the Entire CLI and run `entire enable` once (already done on the build machine).
2. Open the checkpoints branch linked in section 6, or `git fetch` it and browse it locally.
3. Each checkpoint maps to a commit on `main` (commit messages start with a task id, e.g. `T-0007:`) and holds the prompts, tool calls and transcript that produced it.

## 10. What we did not build and why

- **Accounts.** Everything lives in localStorage on the device; no backend state means nothing to secure or migrate in a one-day build.
- **Multiple languages.** French only, English native. Prompts, normalisation and the voice are tuned for one pair; doing it well beats doing five badly.
- **Streaks and leaderboards.** They optimise for app opens, not for being able to speak. The diary is the progress view.
- **Phoneme scoring.** Needs alignment models we could not validate in a day; the grader works at transcript level.
- **Voice design.** Noé uses a stock Gemini Live voice and a preset Gradium voice; a custom persona voice was a stretch goal.
- **S2S translate.** A Gradium speech-to-speech translate button would teach the learner to lean on translation, which is the habit we want to break.

## 11. Team and licence

Team: <team names go here>

Licence: MIT.
